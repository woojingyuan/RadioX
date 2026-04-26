const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 8765);
const STATION_TIME_ZONE = process.env.RADIOX_TIME_ZONE || "Asia/Tokyo";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".webmanifest": "application/manifest+json; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".png": "image/png",
  ".ico": "image/x-icon"
};

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, fileName), "utf8"));
}

function writeJson(fileName, value) {
  fs.writeFileSync(path.join(DATA_DIR, fileName), `${JSON.stringify(value, null, 2)}\n`);
}

function localDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: STATION_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

function nowParts(date = new Date()) {
  const hour = date.getHours();
  let dayPart = "deep-night";
  if (hour >= 5 && hour < 10) dayPart = "morning";
  else if (hour >= 10 && hour < 15) dayPart = "workday";
  else if (hour >= 15 && hour < 19) dayPart = "dusk";
  else if (hour >= 19 && hour < 23) dayPart = "night";

  return {
    iso: date.toISOString(),
    dateKey: localDateKey(date),
    hour,
    minute: date.getMinutes(),
    dayPart,
    weekday: new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(date),
    label: new Intl.DateTimeFormat("zh-CN", {
      weekday: "long",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date)
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeTerm(value) {
  return String(value || "").trim().toLowerCase();
}

function scheduleTags(planText) {
  const text = normalizeTerm(planText);
  const tags = [];
  if (/(孩子|小孩|儿童|亲子|游乐园|公园|动物园|family|kids|playground|amusement)/i.test(text)) tags.push("family");
  if (/(开心|高兴|快乐|愉快|满足|好玩|happy|fun|joy)/i.test(text)) tags.push("bright");
  if (/(meeting|call|会议|会|面谈|客户|review|汇报)/i.test(text)) tags.push("meetings");
  if (/(run|gym|运动|跑步|健身|骑行|walk|训练)/i.test(text)) tags.push("training");
  if (/(deadline|ship|发布|交付|ddl|写|coding|code|深度|专注)/i.test(text)) tags.push("focus");
  if (/(date|朋友|晚饭|聚|party|演出|live|酒|约)/i.test(text)) tags.push("social");
  if (/(sleep|休息|冥想|恢复|累|疲惫|低落|焦虑|burnout)/i.test(text)) tags.push("recovery");
  return tags.length ? tags : ["open"];
}

function freshManualContext(state, now) {
  return state.contextDate === now.dateKey;
}

function contextVector(state, routines) {
  const now = nowParts();
  const today = routines.days[now.weekday] || routines.default;
  const useManual = freshManualContext(state, now);
  const plan = useManual && state.planText ? state.planText : today.planText || routines.default.planText;
  const weather = useManual && state.weather ? state.weather : today.weather || routines.default.weather;
  const mood = useManual && state.mood ? state.mood : today.mood || routines.default.mood;
  const intensity = Number(useManual && state.intensity != null ? state.intensity : today.intensity ?? routines.default.intensity);

  return {
    now,
    planText: plan,
    scheduleTags: scheduleTags(plan),
    weather,
    mood,
    intensity: clamp(intensity, 1, 5)
  };
}

function overlaps(a, b) {
  const right = new Set((b || []).map(normalizeTerm));
  return (a || []).some((item) => right.has(normalizeTerm(item)));
}

function hasGenre(track, genres) {
  return overlaps(track.genres, genres);
}

function contextTargetEnergy(context) {
  let target = {
    breath: 25,
    focus: 45,
    blue: 32,
    recover: 22,
    drive: 68,
    fire: 84
  }[context.mood] || 50;

  if (context.scheduleTags.includes("family")) target = Math.max(target, 46);
  if (context.scheduleTags.includes("bright")) target = Math.max(target, 50);
  if (context.scheduleTags.includes("recovery") && context.scheduleTags.includes("bright")) {
    target = Math.max(42, Math.min(target, 52));
  }

  return clamp(target + (context.intensity - 3) * 5, 15, 88);
}

function stableHash(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function dailyRotation(track, context) {
  const hash = stableHash(`${context.now.dateKey}:${track.id}`);
  return Math.round(((hash % 1000) / 1000) * 70) / 10;
}

function contextSignature(context) {
  return String(stableHash([
    context.now.dateKey,
    context.now.dayPart,
    context.weather,
    context.mood,
    context.intensity,
    context.planText,
    context.scheduleTags.join(",")
  ].join("|")));
}

function recentPenalty(track, state) {
  const history = state.history || [];
  const lastIndex = history.lastIndexOf(track.id);
  if (lastIndex === -1) return 0;
  const distance = history.length - 1 - lastIndex;
  if (distance <= 2) return 36;
  if (distance <= 8) return 28;
  return 20;
}

function artistKey(artist) {
  return normalizeTerm(artist)
    .replace(/\s*&.*$/, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, " ")
    .trim();
}

function diversify(scored, limit) {
  const selected = [];
  const selectedIds = new Set();
  const artistCounts = new Map();

  for (const track of scored) {
    const key = artistKey(track.artist);
    if ((artistCounts.get(key) || 0) >= 1) continue;
    selected.push(track);
    selectedIds.add(track.id);
    artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
    if (selected.length >= limit) return selected;
  }

  for (const track of scored) {
    if (selectedIds.has(track.id)) continue;
    selected.push(track);
    if (selected.length >= limit) return selected;
  }

  return selected;
}

function scoreTrack(track, context, profile) {
  let score = 0;
  if (track.moods?.includes(context.mood)) score += 26;
  if (track.weather?.includes(context.weather)) score += 14;
  if (track.dayParts?.includes(context.now.dayPart)) score += 14;
  if (overlaps(track.scheduleTags, context.scheduleTags)) score += 14;

  const genreAffinity = (track.genres || []).reduce((sum, genre) => {
    const pref = profile.genreWeights[genre] || 0;
    return sum + pref;
  }, 0);
  score += genreAffinity;

  const targetEnergy = contextTargetEnergy(context);
  score += Math.max(0, 18 - Math.abs((track.energy || 50) - targetEnergy) / 4);

  const eraBias = profile.eraBias?.[track.era] || 0;
  score += eraBias;

  if (context.intensity >= 4 && (track.energy || 0) > 62) score += 8;
  if (context.intensity <= 2 && (track.energy || 100) < 45) score += 8;
  if (context.now.dayPart === "deep-night" && (track.energy || 100) > 78) score -= 16;
  if (context.weather === "rain" && (track.genres || []).includes("jazz")) score += 5;
  if (context.weather === "clear" && (track.genres || []).includes("classic-rock")) score += 4;
  if (context.scheduleTags.includes("family") && hasGenre(track, ["classic-rock", "folk-rock", "j-rock", "mandarin-rock", "pop-vocal"])) score += 8;
  if (context.scheduleTags.includes("family") && hasGenre(track, ["metal", "hard-rock"]) && (track.energy || 0) > 78) score -= 6;
  if (context.scheduleTags.includes("bright") && hasGenre(track, ["classic-rock", "folk-rock", "j-rock", "mandarin-rock", "pop-vocal"])) score += 7;
  if (context.scheduleTags.includes("bright") && (track.energy || 0) >= 42 && (track.energy || 0) <= 78) score += 5;
  if (context.scheduleTags.includes("recovery") && context.scheduleTags.includes("bright")) {
    if ((track.energy || 0) < 30) score -= 5;
    if ((track.energy || 0) >= 35 && (track.energy || 0) <= 60) score += 5;
  }

  return Math.round(score * 10) / 10;
}

function decorateTrack(track, context, profile, state) {
  return {
    ...track,
    score: scoreTrack(track, context, profile) + dailyRotation(track, context) - recentPenalty(track, state),
    reason: makeReason(track, context)
  };
}

function recommend(profile, catalog, context, state) {
  const scored = catalog
    .map((track) => decorateTrack(track, context, profile, state))
    .sort((a, b) => b.score - a.score);
  return diversify(scored, 10);
}

function queueFromOrder(order, catalog, context, profile, state) {
  const byId = new Map(catalog.map((track) => [track.id, track]));
  return (order || [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((track) => decorateTrack(track, context, profile, state));
}

function resolveQueue(profile, catalog, context, state) {
  const signature = contextSignature(context);
  const generated = recommend(profile, catalog, context, state);
  const savedOrder = Array.isArray(state.queueOrder) ? state.queueOrder : [];
  const canUseSaved = state.queueDate === context.now.dateKey
    && state.queueSignature === signature
    && savedOrder.length > 0;

  if (!canUseSaved) {
    const queue = generated;
    return {
      queue,
      order: queue.map((track) => track.id),
      signature,
      stale: true
    };
  }

  const savedQueue = queueFromOrder(savedOrder, catalog, context, profile, state);
  const seen = new Set(savedQueue.map((track) => track.id));
  const filledQueue = [
    ...savedQueue,
    ...generated.filter((track) => !seen.has(track.id))
  ].slice(0, 10);

  return {
    queue: filledQueue,
    order: filledQueue.map((track) => track.id),
    signature,
    stale: false
  };
}

function makeReason(track, context) {
  const weatherLine = {
    clear: "天气清亮，适合把吉他和人声放在前面",
    rain: "雨天会把低频和铜管擦得更亮一点",
    cloudy: "云层压低时，旋律需要留出呼吸",
    windy: "风大的时候，节奏可以推着你往前走",
    hot: "热的时候少一点堆叠，多一点律动",
    cold: "冷空气里，弦乐和布鲁斯会更贴身"
  }[context.weather] || "今天的空气适合慢慢进入";

  const moodLine = {
    breath: "让呼吸先落地",
    focus: "给专注留一个稳定的脉冲",
    blue: "不急着把情绪拉起来，先陪它待一会儿",
    recover: "把一天的噪声往后推",
    drive: "需要一点向前的推力",
    fire: "把年轻时那点电流叫回来"
  }[context.mood] || "给现在的状态找一个入口";

  const scheduleLine = context.scheduleTags.includes("family")
    ? "今天有孩子的喧闹和快乐，歌要温一点，也要有一点亮"
    : context.scheduleTags.includes("bright")
      ? "今天的情绪不是低落，是累过之后还有光"
      : context.scheduleTags.includes("focus")
        ? "手边的事情需要一个不抢戏的节拍"
        : "今天不用把状态解释得太满";

  return `${weatherLine}，${moodLine}。${scheduleLine}，${track.artist} 这首歌刚好卡在这个缝里。`;
}

function makeDjScript(current, context, profile) {
  const plan = context.planText.replace(/\s+/g, " ").slice(0, 90);
  const artistEcho = current.artist.includes("Linkin Park")
    ? "这名字对你不是算法，是旧火种。"
    : current.genres.includes("classical")
      ? "这不是退烧，是把注意力重新调音。"
      : current.genres.includes("jazz")
        ? "让鼓刷和贝斯替你把边界画出来。"
        : "这段不需要解释太多，让第一句自己开门。";

  return [
    {
      by: profile.djName,
      at: "now",
      text: `现在是${context.now.label}。${profile.nickname}，我看见今天的关键词是：${plan || "留白"}。`
    },
    {
      by: profile.djName,
      at: "+04s",
      text: `${current.title}，${current.artist}。${current.reason}`
    },
    {
      by: profile.djName,
      at: "+11s",
      text: `${artistEcho} 接下来 ${Math.round(current.energy)}% 的能量，不吵，但会把你带起来。`
    }
  ];
}

function stationPayload(options = {}) {
  const profile = readJson("profile.json");
  const catalog = readJson("playlist-catalog.json");
  const routines = readJson("routines.json");
  let state = readJson("state.json");
  const context = contextVector(state, routines);
  const queueState = resolveQueue(profile, catalog, context, state);
  if (options.persistQueue && queueState.stale) {
    state = {
      ...state,
      currentIndex: 0,
      queueDate: context.now.dateKey,
      queueSignature: queueState.signature,
      queueOrder: queueState.order,
      updatedAt: new Date().toISOString()
    };
    writeJson("state.json", state);
  }

  const queue = queueState.queue;
  const rawIndex = queueState.stale ? 0 : Number(state.currentIndex || 0);
  const currentIndex = clamp(rawIndex, 0, Math.max(queue.length - 1, 0));
  const current = queue[currentIndex] || queue[0];
  const transcript = current ? makeDjScript(current, context, profile) : [];

  return {
    station: {
      name: profile.stationName,
      djName: profile.djName,
      nickname: profile.nickname,
      onAir: true,
      listenerCount: 1
    },
    profile,
    context,
    current,
    queue,
    transcript,
    state: {
      playing: Boolean(state.playing),
      currentIndex,
      queueOrder: queueState.order,
      queueSignature: queueState.signature,
      volume: state.volume ?? 76,
      spotifyDeviceId: state.spotifyDeviceId || null
    }
  };
}

function send(res, status, body, headers = {}) {
  const payload = typeof body === "string" || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(payload);
}

function sendJson(res, status, body) {
  send(res, status, body, { "Content-Type": "application/json; charset=utf-8" });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/config") {
    sendJson(res, 200, {
      spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
      spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/now") {
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/context") {
    const body = await parseBody(req);
    const state = readJson("state.json");
    const next = {
      ...state,
      mood: body.mood || state.mood,
      weather: body.weather || state.weather,
      intensity: body.intensity ?? state.intensity,
      planText: typeof body.planText === "string" ? body.planText : state.planText,
      currentIndex: 0,
      contextDate: localDateKey(),
      queueDate: localDateKey(),
      queueSignature: null,
      queueOrder: [],
      updatedAt: new Date().toISOString()
    };
    writeJson("state.json", next);
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/play-state") {
    const body = await parseBody(req);
    const state = readJson("state.json");
    writeJson("state.json", {
      ...state,
      playing: Boolean(body.playing),
      volume: body.volume ?? state.volume,
      spotifyDeviceId: body.spotifyDeviceId || state.spotifyDeviceId,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/next") {
    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const current = payload.current;
    const history = current ? [...(state.history || []), current.id].slice(-30) : state.history || [];
    writeJson("state.json", {
      ...state,
      currentIndex: Number(payload.state.currentIndex || 0) + 1,
      history,
      queueDate: localDateKey(),
      queueSignature: payload.state.queueSignature,
      queueOrder: payload.state.queueOrder,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/reset") {
    const state = readJson("state.json");
    writeJson("state.json", {
      ...state,
      currentIndex: 0,
      history: [],
      queueDate: localDateKey(),
      queueSignature: null,
      queueOrder: [],
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  return false;
}

function safeStaticPath(urlPathname) {
  const cleanPath = decodeURIComponent(urlPathname === "/" ? "/index.html" : urlPathname);
  const filePath = path.normalize(path.join(PUBLIC_DIR, cleanPath));
  if (!filePath.startsWith(PUBLIC_DIR)) return null;
  return filePath;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      const handled = await handleApi(req, res, url);
      if (!handled) sendJson(res, 404, { error: "Not found" });
      return;
    }

    const filePath = safeStaticPath(url.pathname);
    const candidate = filePath && fs.existsSync(filePath) && fs.statSync(filePath).isFile()
      ? filePath
      : path.join(PUBLIC_DIR, "index.html");
    const ext = path.extname(candidate);
    const content = fs.readFileSync(candidate);
    send(res, 200, content, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" ? "no-store" : "public, max-age=300"
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`RadioX Server listening on http://127.0.0.1:${PORT}`);
  console.log("connected to local taste / schedule / Spotify bridge");
});
