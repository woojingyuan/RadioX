const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
loadLocalEnv(path.join(ROOT, ".env"));

const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const PORT = Number(process.env.PORT || 8765);
const STATION_TIME_ZONE = process.env.RADIOX_TIME_ZONE || "Asia/Tokyo";
const QUEUE_SIZE = 10;
const RECENT_AVOID_COUNT = 18;
const RECOMMENDATION_COOLDOWN_DAYS = 7;
const RECOMMENDATION_COOLDOWN_SIGNATURE = `weekly-cooldown-v${RECOMMENDATION_COOLDOWN_DAYS}`;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 14000);
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "marin";
const OPENAI_TTS_FORMAT = process.env.OPENAI_TTS_FORMAT || "mp3";
const OPENAI_TTS_SPEED = Number(process.env.OPENAI_TTS_SPEED || 0.88);
const OPENAI_TTS_TIMEOUT_MS = Number(process.env.OPENAI_TTS_TIMEOUT_MS || 12000);
const OPENAI_TTS_INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS
  || "用中文普通话说。像一个成熟、温暖的深夜电台 DJ，正在跟一位老朋友低声聊天。不要播音腔，不要朗诵腔，不要客服腔。句子之间要有自然呼吸，讲歌名和乐队名时稍微停一下。情绪克制，有一点怀旧和松弛感，像饭后慢慢聊起一首老歌。";
const TTS_PROVIDER = String(process.env.TTS_PROVIDER || process.env.RADIOX_TTS_PROVIDER || "auto").trim().toLowerCase();
const INWORLD_TTS_ENDPOINT = process.env.INWORLD_TTS_ENDPOINT || "https://api.inworld.ai/tts/v1/voice";
const INWORLD_TTS_MODEL = process.env.INWORLD_TTS_MODEL || "inworld-tts-1.5-max";
const INWORLD_TTS_VOICE_ID = process.env.INWORLD_TTS_VOICE_ID || process.env.INWORLD_TTS_VOICE || "Dennis";
const INWORLD_TTS_AUDIO_ENCODING = process.env.INWORLD_TTS_AUDIO_ENCODING || "LINEAR16";
const INWORLD_TTS_SAMPLE_RATE_HERTZ = Number(process.env.INWORLD_TTS_SAMPLE_RATE_HERTZ || 22050);
const INWORLD_TTS_TEMPERATURE = Number(process.env.INWORLD_TTS_TEMPERATURE || 0.9);
const INWORLD_TTS_TEXT_NORMALIZATION = process.env.INWORLD_TTS_TEXT_NORMALIZATION || "ON";
const INWORLD_TTS_TIMEOUT_MS = Number(process.env.INWORLD_TTS_TIMEOUT_MS || 12000);
const DJ_SCRIPT_CACHE_LIMIT = 48;
const DJ_AUDIO_CACHE_LIMIT = 24;
const DJ_CHAT_LIMIT = 40;
const djScriptCache = new Map();
const djAudioCache = new Map();

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

function loadLocalEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  lines.forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (!match || process.env[match[1]] != null) return;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[match[1]] = value;
  });
}

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

function normalizeStringArray(value, fallback = [], limit = 80) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,，]+/)
      : fallback;
  return [...new Set(source
    .map((item) => String(item || "").trim())
    .filter(Boolean))]
    .slice(0, limit);
}

function normalizeNumberMap(value, fallback = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  return Object.fromEntries(Object.entries(source)
    .map(([key, raw]) => [String(key || "").trim(), Number(raw)])
    .filter(([key, raw]) => key && Number.isFinite(raw))
    .map(([key, raw]) => [key, Math.round(clamp(raw, -50, 50))]));
}

function normalizeTimePreferences(value, fallback = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : fallback;
  const out = {};
  ["morning", "workday", "dusk", "night", "deep-night"].forEach((part) => {
    const item = source[part];
    if (!item || typeof item !== "object" || Array.isArray(item)) return;
    const genres = normalizeStringArray(item.genres, fallback[part]?.genres || [], 24);
    const boost = Math.round(clamp(Number(item.boost ?? fallback[part]?.boost ?? 0), -30, 30));
    if (genres.length || boost) out[part] = { genres, boost };
  });
  return out;
}

function normalizeProfilePayload(body, current) {
  const next = {
    ...current,
    stationName: String(body.stationName || current.stationName || "RadioX").trim().slice(0, 40),
    djName: String(body.djName || current.djName || "RadioX").trim().slice(0, 40),
    nickname: String(body.nickname || current.nickname || "老朋友").trim().slice(0, 40),
    tagline: String(body.tagline || current.tagline || "").trim().slice(0, 180),
    tasteAnchors: normalizeStringArray(body.tasteAnchors, current.tasteAnchors, 80),
    currentLean: normalizeStringArray(body.currentLean, current.currentLean, 40),
    genreWeights: normalizeNumberMap(body.genreWeights, current.genreWeights),
    eraBias: normalizeNumberMap(body.eraBias, current.eraBias),
    timePreferences: normalizeTimePreferences(body.timePreferences, current.timePreferences)
  };
  if (!next.tasteAnchors.length) next.tasteAnchors = current.tasteAnchors || [];
  if (!next.currentLean.length) next.currentLean = current.currentLean || [];
  return next;
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

function fallbackTrackStory(track) {
  const genreLabel = (track.genres || []).slice(0, 2).join(" / ") || "music";
  return {
    headline: "RadioX crate note",
    text: `${track.artist} 这首歌被放进 RadioX，是因为它的 ${genreLabel} 气质能接住今天的状态。`
  };
}

function attachTrackStories(catalog, stories) {
  return catalog.map((track) => ({
    ...track,
    story: stories[track.id] || fallbackTrackStory(track)
  }));
}

function timePreferenceBoost(track, context, profile) {
  const preference = profile.timePreferences?.[context.now.dayPart];
  if (!preference || !hasGenre(track, preference.genres)) return 0;
  return Number(preference.boost || 0);
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

function dateKeyToUtcMs(dateKey) {
  const match = String(dateKey || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return NaN;
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysBetweenDateKeys(laterKey, earlierKey) {
  const later = dateKeyToUtcMs(laterKey);
  const earlier = dateKeyToUtcMs(earlierKey);
  if (!Number.isFinite(later) || !Number.isFinite(earlier)) return Infinity;
  return Math.floor((later - earlier) / DAY_MS);
}

function pruneRecommendationHistory(history, todayKey) {
  const source = history && typeof history === "object" && !Array.isArray(history)
    ? history
    : {};
  const pruned = {};

  Object.entries(source).forEach(([trackId, dateKey]) => {
    const age = daysBetweenDateKeys(todayKey, dateKey);
    if (trackId && age >= 0 && age < RECOMMENDATION_COOLDOWN_DAYS) {
      pruned[trackId] = dateKey;
    }
  });

  return pruned;
}

function seedRecommendationHistory(state, context) {
  return {
    ...state,
    recommendationHistory: pruneRecommendationHistory(state.recommendationHistory, context.now.dateKey)
  };
}

function notePlayedTrack(state, trackId, context) {
  const history = pruneRecommendationHistory(state.recommendationHistory, context.now.dateKey);
  const id = String(trackId || "").trim();
  if (id) history[id] = context.now.dateKey;
  return history;
}

function weeklyAvoidIds(state, context) {
  return new Set(Object.keys(pruneRecommendationHistory(state.recommendationHistory, context.now.dateKey)));
}

function rememberLimited(map, key, value, limit) {
  if (!key || !value) return;
  map.set(key, value);
  if (map.size <= limit) return;
  const oldestKey = map.keys().next().value;
  map.delete(oldestKey);
}

function dailyRotation(track, context) {
  const hash = stableHash(`${context.now.dateKey}:${track.id}`);
  return Math.round(((hash % 1000) / 1000) * 70) / 10;
}

function contextSignature(context, profile) {
  const activeTimePreference = profile.timePreferences?.[context.now.dayPart] || {};
  return String(stableHash([
    context.now.dateKey,
    context.now.dayPart,
    context.weather,
    context.mood,
    context.intensity,
    context.planText,
    context.scheduleTags.join(","),
    JSON.stringify(profile.genreWeights || {}),
    JSON.stringify(profile.eraBias || {}),
    JSON.stringify(activeTimePreference),
    RECOMMENDATION_COOLDOWN_SIGNATURE
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

function diversify(scored, limit, initial = []) {
  const selected = [...initial];
  const selectedIds = new Set(selected.map((track) => track.id));
  const artistCounts = new Map();

  selected.forEach((track) => {
    const key = artistKey(track.artist);
    artistCounts.set(key, (artistCounts.get(key) || 0) + 1);
  });

  for (const track of scored) {
    if (selectedIds.has(track.id)) continue;
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

function recentAvoidIds(state) {
  return new Set((state.history || []).slice(-RECENT_AVOID_COUNT));
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
  score += timePreferenceBoost(track, context, profile);

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
  const recentIds = recentAvoidIds(state);
  const weeklyIds = weeklyAvoidIds(state, context);
  const strictFresh = scored.filter((track) => !recentIds.has(track.id) && !weeklyIds.has(track.id));
  const selected = diversify(strictFresh, QUEUE_SIZE);
  if (selected.length >= QUEUE_SIZE) return selected;

  const weekFresh = scored.filter((track) => !weeklyIds.has(track.id));
  const withWeekFresh = diversify(weekFresh, QUEUE_SIZE, selected);
  if (withWeekFresh.length >= QUEUE_SIZE) return withWeekFresh;

  const recentlyFresh = scored.filter((track) => !recentIds.has(track.id));
  const withRecentFresh = diversify(recentlyFresh, QUEUE_SIZE, withWeekFresh);
  if (withRecentFresh.length >= QUEUE_SIZE) return withRecentFresh;

  return diversify(scored, QUEUE_SIZE, withRecentFresh);
}

function queueFromOrder(order, catalog, context, profile, state) {
  const byId = new Map(catalog.map((track) => [track.id, track]));
  return (order || [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((track) => decorateTrack(track, context, profile, state));
}

function resolveQueue(profile, catalog, context, state) {
  const signature = contextSignature(context, profile);
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
  ].slice(0, QUEUE_SIZE);

  return {
    queue: filledQueue,
    order: filledQueue.map((track) => track.id),
    signature,
    stale: false
  };
}

function makeReason(track, context) {
  const genreLine = hasGenre(track, ["classical", "neo-classical"])
    ? "钢琴或弦乐的留白会把注意力从屏幕边缘轻轻拉开，声音之间的空处比旋律本身还重要"
    : hasGenre(track, ["jazz"])
      ? "爵士的低频和鼓点不是催促，而是在旁边给你一个稳定的摆动，让脑子不用一直绷着"
      : hasGenre(track, ["blues"])
        ? "布鲁斯的句尾总带着一点沙哑和停顿，疲惫在这种声音里不会显得狼狈"
        : hasGenre(track, ["metal", "hard-rock"])
          ? "吉他墙有重量，但不是乱冲；它更像把压在身体里的劲儿整理成一个可控的出口"
          : hasGenre(track, ["folk-rock", "mandarin-rock"])
            ? "木吉他和人声靠前，像把话说到你旁边，不用隔着很大的舞台"
            : "旋律线不复杂，能让今天的情绪有地方停一下";

  const moodLine = {
    breath: "你现在不需要被催着振作，更适合先把注意力放回身体里",
    focus: "它能给专注一个稳定的底盘，又不会抢走你正在处理的事情",
    blue: "它不急着把情绪抬高，只把低处的东西照清楚一点",
    recover: "它会把白天的噪声往后放，让恢复这件事变得没那么用力",
    drive: "它有一点往前走的推力，但不会把人推到失控的位置",
    fire: "它把年轻时那股电流拿出来，却不只是靠音量取胜"
  }[context.mood] || "它跟你现在的状态有一段距离刚好的靠近";

  const storyLine = track.story?.headline
    ? `这首歌背后的线索是“${track.story.headline}”，所以它不只是旋律选择，也是一段可以放进今天的故事`
    : `${track.artist} 的声音在这里比标签更重要`;

  return `${genreLine}。${moodLine}。${storyLine}。`;
}

function makeDjScript(current, context, profile) {
  const story = current.story?.text || "";

  return [
    {
      by: profile.djName,
      at: "now",
      text: `${profile.nickname}，现在放 ${current.artist} 的 ${current.title}。`
    },
    {
      by: profile.djName,
      at: "+04s",
      text: `${current.title}，${current.artist}。${current.reason}`
    },
    {
      by: profile.djName,
      at: "+08s",
      text: story
    }
  ].filter((line) => line.text);
}

function openAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function djScriptCacheKey(payload) {
  const { current, context } = payload;
  return [
    current?.id || "",
    context?.now?.dateKey || "",
    context?.now?.dayPart || "",
    context?.weather || "",
    context?.mood || "",
    context?.intensity || "",
    context?.planText || "",
    current?.story?.text || ""
  ].join("|");
}

function rememberCachedDjScript(key, transcript) {
  if (!key || !transcript?.length) return;
  rememberLimited(djScriptCache, key, transcript, DJ_SCRIPT_CACHE_LIMIT);
}

function extractOpenAiText(body) {
  if (typeof body.output_text === "string") return body.output_text;
  const chunks = [];
  (body.output || []).forEach((item) => {
    (item.content || []).forEach((content) => {
      if (typeof content.text === "string") chunks.push(content.text);
    });
  });
  return chunks.join("\n").trim();
}

function parseDjJson(text) {
  const cleaned = String(text || "")
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (error) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) throw error;
    return JSON.parse(match[0]);
  }
}

function normalizeDjLine(value, maxLength = 280) {
  const staleWeatherPhrase = new RegExp("\\u4e91\\u5c42\\u538b\\u7740[^。！？!?]*\\u900f\\u6c14\\u7684\\u7a7a\\u95f4[。！？!?]*", "g");
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(staleWeatherPhrase, "")
    .replace(/想着你今天这件事：?[^。！？!?]*[。！？!?，,、\s]*/g, "")
    .replace(/这首歌不用急[，,、\s]*慢慢进来就好[。！？!?]*/g, "")
    .replace(/^听完(?:它|这首歌?|这一首)[，,、\s]*/g, "")
    .replace(/听完(?:它|这首歌?|这一首)[，,、\s]*/g, "")
    .replace(/^我们?顺着(?:情绪|这份情绪|这种情绪|今天的情绪)(?:走进|进入|来到)?[，,、\s]*/g, "")
    .replace(/顺着情绪走进/g, "")
    .replace(/我们接着(?:走进|进入|来到)[^，。！？!?]*[，,、\s]*/g, "")
    .replace(/^[，,、\s]+|[，,、\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeChatText(value, maxLength = 1400) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function countMatches(value, pattern) {
  return (value.match(pattern) || []).length;
}

function chatReplyLooksComplete(value) {
  const text = normalizeChatText(value, 700);
  if (!text) return false;
  if (!/[。！？!?…」』”）)]$/.test(text)) return false;
  const pairs = [
    [/《/g, /》/g],
    [/“/g, /”/g],
    [/「/g, /」/g],
    [/『/g, /』/g],
    [/（/g, /）/g],
    [/\(/g, /\)/g]
  ];
  return pairs.every(([open, close]) => countMatches(text, open) <= countMatches(text, close));
}

function compactChat(messages) {
  return (messages || [])
    .filter((message) => ["user", "assistant"].includes(message.role) && message.text)
    .map((message) => ({
      role: message.role,
      text: normalizeChatText(message.text, 1400),
      at: message.at || new Date().toISOString()
    }))
    .slice(-DJ_CHAT_LIMIT);
}

function aiScriptToTranscript(script, profile) {
  const parts = [
    ["now", script.intro],
    ["+07s", script.story],
    ["+16s", script.fit],
    ["+25s", script.segue]
  ];
  return parts
    .map(([at, text]) => ({
      by: profile.djName,
      at,
      text: normalizeDjLine(text)
    }))
    .filter((line) => line.text);
}

function buildDjPrompt(payload) {
  const { current, context, profile } = payload;
  return JSON.stringify({
    listener: profile.nickname,
    station: profile.stationName,
    currentTrack: {
      title: current.title,
      artist: current.artist,
      genres: current.genres,
      energy: current.energy,
      storyHeadline: current.story?.headline,
      storySeed: current.story?.text,
      recommendationReason: current.reason
    },
    dayContext: {
      dayPart: context.now.dayPart,
      weather: context.weather,
      mood: context.mood,
      intensity: context.intensity,
      planText: context.planText,
      scheduleTags: context.scheduleTags
    },
    listenerTaste: {
      currentLean: profile.currentLean,
      anchors: profile.tasteAnchors,
      nightPreference: profile.timePreferences?.[context.now.dayPart] || null
    }
  });
}

async function generateAiDjTranscript(payload) {
  if (!openAiConfigured() || !payload.current) return null;
  const key = djScriptCacheKey(payload);
  if (djScriptCache.has(key)) return djScriptCache.get(key);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning: { effort: "low" },
        instructions: [
          "你是 RadioX，一个只服务一位听众的 24 小时私人电台 DJ。",
          "听众是老朋友。语气要像夜里开车、饭后散步、旧友叙旧：自然、松弛、具体、不过度煽情。",
          "任务：先介绍歌曲，再深挖提供的歌曲故事或乐队/歌手线索，最后说明旋律、能量、配器或时代气质为什么切合听众今天的状态。",
          "故事要有纵深：从 storySeed 里展开创作背景、乐队处境、主唱气质、录音/现场感或时代情绪；如果资料很少，就明确围绕已给线索展开，不要编造新事实。",
          "切合状态的分析要更像真正 DJ 的长段落：说出声音怎么影响身体、注意力、疲劳、白天的计划余波，而不是只给一句泛泛的适合。",
          "只能基于输入里的 storySeed 和 recommendationReason 讲事实；不要编造新事实，不要引用歌词，不要提 OpenAI、AI、算法或 prompt。",
          "禁止使用天气压迫、空间透气、呼吸落地、卡在缝隙、接住状态这类抽象套话。要说具体声音、配器、节奏、歌手故事。",
          "只介绍 currentTrack，不要预告下一首或上一首。禁止说“听完它”“听完这首”“顺着情绪走进”“我们接着走进”。",
          "可以参考 dayContext 理解听众状态，但不要逐字复述 planText，不要说“想着你今天这件事”。",
          "不要用百分比描述能量，不要说“不吵，但会把你带起来”，不要说“第一句自己开门”。",
          "不要重复具体时间。不要写 Markdown。不要使用列表。",
          "返回 JSON object，字段必须是 intro、story、fit、segue。",
          "长度：intro 40-90 中文字符；story 140-240 中文字符；fit 130-230 中文字符；segue 60-120 中文字符。segue 只收束当前正在播放的歌，不要转到下一首。"
        ].join("\n"),
        input: buildDjPrompt(payload),
        max_output_tokens: 1600
      })
    });

    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn("OpenAI DJ failed", response.status, body.error?.message || response.statusText);
      return null;
    }

    const script = parseDjJson(extractOpenAiText(body));
    const transcript = aiScriptToTranscript(script, payload.profile);
    if (transcript.length < 2) return null;
    rememberCachedDjScript(key, transcript);
    return transcript;
  } catch (error) {
    console.warn("OpenAI DJ fallback", error.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function fallbackDjChatReply(payload, userText) {
  const current = payload.current;
  const context = payload.context;
  const story = current?.story?.headline ? `我先抓住这首歌的线头：${current.story.headline}。` : "";
  const mood = {
    breath: "你现在像是需要慢慢把气放出来",
    focus: "你现在更像需要一个稳定的节拍",
    blue: "你现在的情绪不用急着被拉亮",
    recover: "你现在需要把一天的噪声往后推",
    drive: "你现在需要一点向前的推力",
    fire: "你现在可以把那点旧电流叫回来"
  }[context.mood] || "我听见你现在的状态了";
  return normalizeChatText(`${story}${mood}。你刚才说“${userText}”，我会把它记在这一轮的对话里；如果你想，我可以顺着这句话把下一首往更安静、更硬，或者更有故事感的方向带。`, 900);
}

function buildDjChatPrompt(payload, userText, history) {
  const { current, context, profile, queue } = payload;
  return JSON.stringify({
    listener: profile.nickname,
    userMessage: userText,
    recentConversation: history.slice(-10),
    currentTrack: current ? {
      title: current.title,
      artist: current.artist,
      genres: current.genres,
      energy: current.energy,
      storyHeadline: current.story?.headline,
      storySeed: current.story?.text,
      recommendationReason: current.reason
    } : null,
    dayContext: {
      dayPart: context.now.dayPart,
      weather: context.weather,
      mood: context.mood,
      intensity: context.intensity,
      planText: context.planText,
      scheduleTags: context.scheduleTags
    },
    listenerTaste: {
      currentLean: profile.currentLean,
      anchors: profile.tasteAnchors,
      nightPreference: profile.timePreferences?.[context.now.dayPart] || null
    },
    queuePreview: queue.slice(0, 5).map((track) => ({
      title: track.title,
      artist: track.artist,
      storyHeadline: track.story?.headline
    }))
  });
}

async function generateDjChatReply(payload, userText, history) {
  if (!openAiConfigured()) return fallbackDjChatReply(payload, userText);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        reasoning: { effort: "low" },
        instructions: [
          "你是 RadioX，一个私人电台 DJ，只和一位叫老朋友的听众聊天。",
          "用中文回答。像老友在音乐声里聊天，温暖、自然、具体，不要客服腔，不要长篇教学。",
          "你可以回应听众的当天状态，也可以把回答连接到当前歌曲、歌手故事、旋律、能量、队列方向。",
          "只能基于输入里的歌曲故事和上下文讲事实；不要编造音乐史事实，不要引用歌词。",
          "禁止使用这些套话：让呼吸先落地、卡在缝里、刚好卡在、接住你的状态、状态找入口。每次回答都要落在具体歌曲、声音或故事上。",
          "不要用百分比描述能量，不要说“不吵，但会把你带起来”，不要说“第一句自己开门”。",
          "如果用户请求调整推荐方向，可以先口头确认，但不要声称已经执行代码外的播放操作。",
          "回答 1 到 4 句话，总长不超过 500 个中文字符。必须以完整中文标点收尾，不能半句停止，不能留下未闭合的书名号、引号或括号。不要 Markdown。"
        ].join("\n"),
        input: buildDjChatPrompt(payload, userText, history),
        max_output_tokens: 1200
      })
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.warn("OpenAI chat failed", response.status, body.error?.message || response.statusText);
      return fallbackDjChatReply(payload, userText);
    }
    const text = normalizeChatText(extractOpenAiText(body), 1000);
    if (!chatReplyLooksComplete(text)) {
      console.warn("OpenAI chat incomplete reply", text);
      return fallbackDjChatReply(payload, userText);
    }
    return text;
  } catch (error) {
    console.warn("OpenAI chat fallback", error.message);
    return fallbackDjChatReply(payload, userText);
  } finally {
    clearTimeout(timer);
  }
}

async function stationPayloadWithDj(options = {}) {
  const payload = stationPayload(options);
  payload.aiDj = {
    configured: openAiConfigured(),
    source: "local",
    model: openAiConfigured() ? OPENAI_MODEL : null
  };
  const transcript = await generateAiDjTranscript(payload);
  if (transcript) {
    payload.transcript = transcript;
    payload.aiDj.source = "openai";
  }
  return payload;
}

function stationPayload(options = {}) {
  const profile = readJson("profile.json");
  const stories = readJson("song-stories.json");
  const catalog = attachTrackStories(readJson("playlist-catalog.json"), stories);
  const routines = readJson("routines.json");
  let state = readJson("state.json");
  const context = contextVector(state, routines);
  state = seedRecommendationHistory(state, context);
  let queueState = resolveQueue(profile, catalog, context, state);
  const storedIndex = Number(state.currentIndex || 0);
  const queueExhausted = !queueState.stale && queueState.queue.length > 0 && storedIndex >= queueState.queue.length;

  if (options.persistQueue && queueExhausted) {
    state = {
      ...state,
      currentIndex: 0,
      queueSignature: null,
      queueOrder: []
    };
    queueState = resolveQueue(profile, catalog, context, state);
  }

  if (options.persistQueue && (queueState.stale || queueExhausted)) {
    state = {
      ...state,
      currentIndex: 0,
      recommendationHistory: pruneRecommendationHistory(state.recommendationHistory, context.now.dateKey),
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
      spotifyDeviceId: state.spotifyDeviceId || null,
      favoriteIds: Array.isArray(state.favoriteIds) ? state.favoriteIds : [],
      favoriteRequest: state.favoriteRequest || null,
      djChat: compactChat(state.djChat)
    }
  };
}

function openAiTtsConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
}

function inworldTtsConfigured() {
  return Boolean(String(process.env.INWORLD_API_KEY || "").trim());
}

function activeTtsProvider() {
  if (TTS_PROVIDER === "inworld") return inworldTtsConfigured() ? "inworld" : null;
  if (TTS_PROVIDER === "openai") return openAiTtsConfigured() ? "openai" : null;
  if (inworldTtsConfigured()) return "inworld";
  if (openAiTtsConfigured()) return "openai";
  return null;
}

function ttsConfigured() {
  return Boolean(activeTtsProvider());
}

function normalizeTtsText(value) {
  const paragraphs = String(value || "")
    .replace(/\r/g, "\n")
    .replace(/RadioX/g, "Radio X")
    .replace(/&/g, "和")
    .split(/\n{2,}/)
    .map((paragraph) => paragraph
      .replace(/[ \t]+/g, " ")
      .replace(/([。！？!?])\s*(?=\S)/g, "$1\n")
      .replace(/([，、；;])\s*/g, "$1 ")
      .replace(/\s*\n\s*/g, "\n")
      .trim())
    .filter(Boolean);
  return paragraphs.join("\n\n").slice(0, 1800);
}

function djAudioCacheKey(provider, settings, text) {
  return String(stableHash([
    provider,
    ...settings,
    text
  ].join("|")));
}

function openAiAudioCacheKey(text) {
  return djAudioCacheKey("openai", [
    OPENAI_TTS_MODEL,
    OPENAI_TTS_VOICE,
    OPENAI_TTS_FORMAT,
    OPENAI_TTS_SPEED
  ], text);
}

function inworldAudioCacheKey(text) {
  return djAudioCacheKey("inworld", [
    INWORLD_TTS_MODEL,
    INWORLD_TTS_VOICE_ID,
    INWORLD_TTS_AUDIO_ENCODING,
    INWORLD_TTS_SAMPLE_RATE_HERTZ,
    INWORLD_TTS_TEMPERATURE,
    INWORLD_TTS_TEXT_NORMALIZATION
  ], text);
}

function audioContentType(provider = activeTtsProvider()) {
  if (provider === "inworld") return inworldAudioContentType();
  return {
    mp3: "audio/mpeg",
    wav: "audio/wav",
    opus: "audio/ogg",
    aac: "audio/aac",
    flac: "audio/flac",
    pcm: "application/octet-stream"
  }[OPENAI_TTS_FORMAT] || "audio/mpeg";
}

function inworldAudioContentType() {
  return {
    LINEAR16: "audio/wav",
    WAV: "audio/wav",
    MP3: "audio/mpeg",
    OGG_OPUS: "audio/ogg",
    MULAW: "audio/basic"
  }[String(INWORLD_TTS_AUDIO_ENCODING || "").toUpperCase()] || "audio/wav";
}

function inworldAuthorizationHeader() {
  const key = String(process.env.INWORLD_API_KEY || "").trim();
  return /^Basic\s+/i.test(key) ? key : `Basic ${key}`;
}

async function generateOpenAiDjAudio(text) {
  const normalized = normalizeTtsText(text);
  if (!openAiTtsConfigured()) {
    const error = new Error("OpenAI TTS is not configured");
    error.statusCode = 503;
    throw error;
  }
  if (!normalized) {
    const error = new Error("Missing TTS text");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = openAiAudioCacheKey(normalized);
  if (djAudioCache.has(cacheKey)) return djAudioCache.get(cacheKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TTS_TIMEOUT_MS);
  try {
    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: OPENAI_TTS_MODEL,
        voice: OPENAI_TTS_VOICE,
        input: normalized,
        instructions: OPENAI_TTS_INSTRUCTIONS,
        response_format: OPENAI_TTS_FORMAT,
        speed: OPENAI_TTS_SPEED
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = new Error(`OpenAI TTS ${response.status}: ${errorText || response.statusText}`);
      error.statusCode = response.status;
      throw error;
    }

    const audio = Buffer.from(await response.arrayBuffer());
    rememberLimited(djAudioCache, cacheKey, audio, DJ_AUDIO_CACHE_LIMIT);
    return audio;
  } finally {
    clearTimeout(timer);
  }
}

async function generateInworldDjAudio(text) {
  const normalized = normalizeTtsText(text);
  if (!inworldTtsConfigured()) {
    const error = new Error("Inworld TTS is not configured");
    error.statusCode = 503;
    throw error;
  }
  if (!normalized) {
    const error = new Error("Missing TTS text");
    error.statusCode = 400;
    throw error;
  }

  const cacheKey = inworldAudioCacheKey(normalized);
  if (djAudioCache.has(cacheKey)) return djAudioCache.get(cacheKey);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), INWORLD_TTS_TIMEOUT_MS);
  try {
    const response = await fetch(INWORLD_TTS_ENDPOINT, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Authorization": inworldAuthorizationHeader(),
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text: normalized,
        voiceId: INWORLD_TTS_VOICE_ID,
        modelId: INWORLD_TTS_MODEL,
        audioConfig: {
          audioEncoding: INWORLD_TTS_AUDIO_ENCODING,
          sampleRateHertz: INWORLD_TTS_SAMPLE_RATE_HERTZ
        },
        temperature: INWORLD_TTS_TEMPERATURE,
        applyTextNormalization: INWORLD_TTS_TEXT_NORMALIZATION
      })
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => response.statusText);
      const error = new Error(`Inworld TTS ${response.status}: ${errorText || response.statusText}`);
      error.statusCode = response.status;
      throw error;
    }

    const payload = await response.json();
    const audioContent = payload.audioContent || payload.result?.audioContent;
    if (!audioContent) {
      const error = new Error("Inworld TTS response did not include audioContent");
      error.statusCode = 502;
      throw error;
    }

    const audio = Buffer.from(audioContent, "base64");
    rememberLimited(djAudioCache, cacheKey, audio, DJ_AUDIO_CACHE_LIMIT);
    return audio;
  } finally {
    clearTimeout(timer);
  }
}

async function generateDjAudio(text) {
  const provider = activeTtsProvider();
  if (provider === "inworld") {
    return {
      provider,
      audio: await generateInworldDjAudio(text),
      contentType: audioContentType(provider)
    };
  }
  if (provider === "openai") {
    return {
      provider,
      audio: await generateOpenAiDjAudio(text),
      contentType: audioContentType(provider)
    };
  }
  const error = new Error("Cloud TTS is not configured");
  error.statusCode = 503;
  throw error;
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
    const provider = activeTtsProvider();
    sendJson(res, 200, {
      spotifyClientId: process.env.SPOTIFY_CLIENT_ID || "",
      spotifyRedirectUri: process.env.SPOTIFY_REDIRECT_URI || `http://127.0.0.1:${PORT}/callback`,
      openAiTtsConfigured: ttsConfigured(),
      ttsConfigured: ttsConfigured(),
      ttsProvider: provider,
      ttsProviderPreference: TTS_PROVIDER
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/profile") {
    sendJson(res, 200, readJson("profile.json"));
    return true;
  }

  if ((req.method === "POST" || req.method === "PUT") && url.pathname === "/api/profile") {
    const body = await parseBody(req);
    const current = readJson("profile.json");
    const nextProfile = normalizeProfilePayload(body, current);
    writeJson("profile.json", nextProfile);
    const state = readJson("state.json");
    writeJson("state.json", {
      ...state,
      currentIndex: 0,
      queueDate: localDateKey(),
      queueSignature: null,
      queueOrder: [],
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/dj-audio") {
    const body = await parseBody(req);
    try {
      const result = await generateDjAudio(body.text);
      send(res, 200, result.audio, {
        "Content-Type": result.contentType,
        "X-RadioX-Voice": `${result.provider}-tts`
      });
    } catch (error) {
      console.warn("Cloud TTS failed", error.message);
      sendJson(res, error.statusCode || 502, { error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await parseBody(req);
    const text = normalizeChatText(body.text);
    if (!text) {
      sendJson(res, 400, { error: "Message is required" });
      return true;
    }

    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const history = compactChat(state.djChat);
    const userMessage = { role: "user", text, at: new Date().toISOString() };
    const replyText = await generateDjChatReply(payload, text, history);
    const assistantMessage = { role: "assistant", text: replyText, at: new Date().toISOString() };
    const nextMessages = compactChat([...history, userMessage, assistantMessage]);
    const latest = readJson("state.json");
    writeJson("state.json", {
      ...latest,
      djChat: nextMessages,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, {
      messages: nextMessages,
      reply: assistantMessage
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/now") {
    sendJson(res, 200, await stationPayloadWithDj({ persistQueue: true }));
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/snapshot") {
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
    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    writeJson("state.json", {
      ...state,
      playing: Boolean(body.playing),
      volume: body.volume ?? state.volume,
      spotifyDeviceId: body.spotifyDeviceId || state.spotifyDeviceId,
      recommendationHistory: body.playing && payload.current
        ? notePlayedTrack(state, payload.current.id, payload.context)
        : pruneRecommendationHistory(state.recommendationHistory, payload.context.now.dateKey),
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
    const nextIndex = Number(payload.state.currentIndex || 0) + 1;
    const queueExhausted = nextIndex >= payload.queue.length;
    writeJson("state.json", {
      ...state,
      currentIndex: queueExhausted ? 0 : nextIndex,
      history,
      recommendationHistory: current
        ? notePlayedTrack(state, current.id, payload.context)
        : pruneRecommendationHistory(state.recommendationHistory, payload.context.now.dateKey),
      queueDate: localDateKey(),
      queueSignature: queueExhausted ? null : payload.state.queueSignature,
      queueOrder: queueExhausted ? [] : payload.state.queueOrder,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/previous") {
    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const previousIndex = Math.max(0, Number(payload.state.currentIndex || 0) - 1);
    writeJson("state.json", {
      ...state,
      currentIndex: previousIndex,
      queueDate: localDateKey(),
      queueSignature: payload.state.queueSignature,
      queueOrder: payload.state.queueOrder,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/jump") {
    const body = await parseBody(req);
    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const requestedTrackId = String(body.trackId || "").trim();
    const idIndex = requestedTrackId
      ? payload.queue.findIndex((track) => track.id === requestedTrackId)
      : -1;
    const targetIndex = idIndex >= 0
      ? idIndex
      : clamp(Number(body.index), 0, Math.max(payload.queue.length - 1, 0));
    const shouldPlay = body.play === true || body.play === "true";
    const current = payload.current;
    const history = current && targetIndex !== payload.state.currentIndex
      ? [...(state.history || []), current.id].slice(-30)
      : state.history || [];
    writeJson("state.json", {
      ...state,
      currentIndex: targetIndex,
      playing: shouldPlay ? true : Boolean(state.playing),
      history,
      recommendationHistory: current && targetIndex !== payload.state.currentIndex
        ? notePlayedTrack(state, current.id, payload.context)
        : pruneRecommendationHistory(state.recommendationHistory, payload.context.now.dateKey),
      queueDate: localDateKey(),
      queueSignature: payload.state.queueSignature,
      queueOrder: payload.state.queueOrder,
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, stationPayload({ persistQueue: true }));
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/favorite") {
    const body = await parseBody(req);
    const payload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const current = payload.current;
    const requestedTrackId = String(body.trackId || current?.id || "").trim();
    const favorite = body.favorite !== false && body.favorite !== "false";
    const ids = new Set(Array.isArray(state.favoriteIds) ? state.favoriteIds : []);
    if (requestedTrackId && favorite) ids.add(requestedTrackId);
    if (requestedTrackId && !favorite) ids.delete(requestedTrackId);
    writeJson("state.json", {
      ...state,
      favoriteIds: [...ids],
      favoriteRequest: requestedTrackId ? {
        trackId: requestedTrackId,
        favorite,
        source: String(body.source || "toolbar").slice(0, 40),
        requestedAt: new Date().toISOString()
      } : state.favoriteRequest,
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
      recommendationHistory: {},
      djChat: [],
      queueDate: localDateKey(),
      queueSignature: null,
      queueOrder: [],
      updatedAt: new Date().toISOString()
    });
    sendJson(res, 200, await stationPayloadWithDj({ persistQueue: true }));
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
