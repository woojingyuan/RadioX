const http = require("http");
const fs = require("fs");
const path = require("path");
const vm = require("vm");
const { URL } = require("url");

const ROOT = path.join(__dirname, "..");
loadLocalEnv(path.join(ROOT, ".env"));

const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const STATE_FILE = process.env.RADIOX_STATE_FILE
  ? path.resolve(process.env.RADIOX_STATE_FILE)
  : path.join(DATA_DIR, "state.json");
const STATE_TEMPLATE_FILE = path.join(DATA_DIR, "state.example.json");
const PORT = Number(process.env.PORT || 8765);
const STATION_TIME_ZONE = process.env.RADIOX_TIME_ZONE || "Asia/Tokyo";
const QUEUE_SIZE = 10;
const RECENT_AVOID_COUNT = 18;
const HISTORY_LIMIT = 120;
const RECOMMENDATION_COOLDOWN_DAYS = 7;
const RECOMMENDATION_ENGINE_VERSION = "diverse-rotation-v2";
const RECOMMENDATION_COOLDOWN_SIGNATURE = `weekly-cooldown-v${RECOMMENDATION_COOLDOWN_DAYS}-${RECOMMENDATION_ENGINE_VERSION}`;
const DISCOVERY_TRACK_LIMIT = 180;
const DISCOVERY_BATCH_SIZE = 12;
const DISCOVERY_MIN_FRESH_TRACKS = QUEUE_SIZE * 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const OPENAI_TIMEOUT_MS = Number(process.env.OPENAI_TIMEOUT_MS || 14000);
const OPENAI_TTS_MODEL = process.env.OPENAI_TTS_MODEL || "gpt-4o-mini-tts";
const OPENAI_TTS_VOICE = process.env.OPENAI_TTS_VOICE || "marin";
const OPENAI_TTS_FORMAT = process.env.OPENAI_TTS_FORMAT || "mp3";
const OPENAI_TTS_SPEED = Number(process.env.OPENAI_TTS_SPEED || 0.88);
const OPENAI_TTS_TIMEOUT_MS = Number(process.env.OPENAI_TTS_TIMEOUT_MS || 12000);
const OPENAI_TTS_INSTRUCTIONS = process.env.OPENAI_TTS_INSTRUCTIONS
  || "用中文普通话说。像一个成熟、温暖的深夜电台 DJ，正在跟熟悉的人低声聊天。不要播音腔，不要朗诵腔，不要客服腔。句子之间要有自然呼吸，讲歌名和乐队名时稍微停一下。情绪克制，有一点怀旧和松弛感，像饭后慢慢聊起一首老歌。不要刻意强调称呼。";
const TTS_PROVIDER = String(process.env.TTS_PROVIDER || process.env.RADIOX_TTS_PROVIDER || "auto").trim().toLowerCase();
const INWORLD_TTS_ENDPOINT = process.env.INWORLD_TTS_ENDPOINT || "https://api.inworld.ai/tts/v1/voice";
const INWORLD_TTS_MODEL = process.env.INWORLD_TTS_MODEL || "inworld-tts-1.5-max";
const INWORLD_TTS_LANGUAGE = process.env.INWORLD_TTS_LANGUAGE || "zh";
const INWORLD_TTS_GENDER = process.env.INWORLD_TTS_GENDER || "female";
const INWORLD_TTS_VOICE_ID = process.env.INWORLD_TTS_VOICE_ID || process.env.INWORLD_TTS_VOICE || "Jing";
const INWORLD_TTS_AUDIO_ENCODING = process.env.INWORLD_TTS_AUDIO_ENCODING || "LINEAR16";
const INWORLD_TTS_SAMPLE_RATE_HERTZ = Number(process.env.INWORLD_TTS_SAMPLE_RATE_HERTZ || 22050);
const INWORLD_TTS_TEMPERATURE = Number(process.env.INWORLD_TTS_TEMPERATURE || 0.9);
const INWORLD_TTS_TEXT_NORMALIZATION = process.env.INWORLD_TTS_TEXT_NORMALIZATION || "ON";
const INWORLD_TTS_TIMEOUT_MS = Number(process.env.INWORLD_TTS_TIMEOUT_MS || 12000);
const OPENWEATHER_API_KEY = process.env.OPENWEATHER_API_KEY || "";
const OPENWEATHER_LAT = Number(process.env.OPENWEATHER_LAT);
const OPENWEATHER_LON = Number(process.env.OPENWEATHER_LON);
const OPENWEATHER_UNITS = process.env.OPENWEATHER_UNITS || "metric";
const OPENWEATHER_LANG = process.env.OPENWEATHER_LANG || "zh_cn";
const OPENWEATHER_LOCATION_LABEL = process.env.OPENWEATHER_LOCATION_LABEL || "";
const OPENWEATHER_CACHE_MS = Number(process.env.OPENWEATHER_CACHE_MS || 10 * 60 * 1000);
const OPENWEATHER_TIMEOUT_MS = Number(process.env.OPENWEATHER_TIMEOUT_MS || 5000);
const DJ_AUDIO_CACHE_LIMIT = 24;
const DJ_CHAT_LIMIT = 40;
const REQUESTED_TRACK_LIMIT = 40;
const CHAT_QUEUE_INSERT_LIMIT = 5;
const WORLD_PENDING_FILE = "world-pending.json";
const WORLD_APPROVED_FILE = "world-approved.json";
const WORLD_CATALOG_VERSION = "world-review-v1";
const djAudioCache = new Map();
const openWeatherCache = {
  value: null,
  fetchedAt: 0,
  pending: null,
  lastError: ""
};

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

function dataFilePath(fileName) {
  return fileName === "state.json" ? STATE_FILE : path.join(DATA_DIR, fileName);
}

function ensureLocalState() {
  if (fs.existsSync(STATE_FILE)) return;
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.copyFileSync(STATE_TEMPLATE_FILE, STATE_FILE);
}

function readJson(fileName) {
  return JSON.parse(fs.readFileSync(dataFilePath(fileName), "utf8"));
}

function readOptionalJson(fileName, fallback) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    console.warn(`Could not read ${fileName}`, error.message);
    return fallback;
  }
}

function writeJson(fileName, value) {
  fs.writeFileSync(dataFilePath(fileName), `${JSON.stringify(value, null, 2)}\n`);
}

ensureLocalState();

function slugifyWorldId(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function readWorldReviewFile(fileName) {
  const raw = readOptionalJson(fileName, { schemaVersion: 1, items: [], updatedAt: null });
  return {
    schemaVersion: Number(raw.schemaVersion || 1),
    items: Array.isArray(raw.items) ? raw.items : [],
    updatedAt: raw.updatedAt || null,
    lastSyncPreview: raw.lastSyncPreview || null
  };
}

function writeWorldReviewFile(fileName, value) {
  writeJson(fileName, {
    schemaVersion: 1,
    items: Array.isArray(value.items) ? value.items : [],
    updatedAt: new Date().toISOString(),
    ...(value.lastSyncPreview ? { lastSyncPreview: value.lastSyncPreview } : {})
  });
}

function readPublicWorldGlobals() {
  const context = { window: {} };
  vm.createContext(context);
  ["world-bands.js", "world-tours.js"].forEach((fileName) => {
    const filePath = path.join(PUBLIC_DIR, fileName);
    if (fs.existsSync(filePath)) {
      vm.runInContext(fs.readFileSync(filePath, "utf8"), context, { filename: fileName });
    }
  });
  return {
    bands: Array.isArray(context.window.RADIOX_WORLD_BANDS) ? context.window.RADIOX_WORLD_BANDS : [],
    tours: context.window.RADIOX_WORLD_TOURS && typeof context.window.RADIOX_WORLD_TOURS === "object"
      ? context.window.RADIOX_WORLD_TOURS
      : {}
  };
}

function providerStatus() {
  return [
    {
      id: "official",
      label: "Official artist sites",
      configured: true,
      mode: "manual-review",
      priority: 1
    },
    {
      id: "spotify",
      label: "Spotify artist metadata",
      configured: Boolean(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
      mode: "metadata-only",
      priority: 2
    },
    {
      id: "musicbrainz",
      label: "MusicBrainz",
      configured: Boolean(process.env.MUSICBRAINZ_USER_AGENT),
      mode: "metadata-only",
      priority: 3
    },
    {
      id: "wikidata",
      label: "Wikidata",
      configured: true,
      mode: "metadata-only",
      priority: 4
    },
    {
      id: "ticketmaster",
      label: "Ticketmaster",
      configured: Boolean(process.env.TICKETMASTER_API_KEY),
      mode: "tour-enhancement",
      priority: 5
    },
    {
      id: "bandsintown",
      label: "Bandsintown",
      configured: Boolean(process.env.BANDSINTOWN_APP_ID),
      mode: "tour-enhancement",
      priority: 6
    }
  ];
}

function normalizeWorldSource(source) {
  const raw = source && typeof source === "object" && !Array.isArray(source) ? source : {};
  return {
    type: cleanTrackLabel(raw.type || raw.provider || "manual", 40),
    label: cleanTrackLabel(raw.label || raw.name || raw.type || "Manual review", 100),
    url: cleanTrackLabel(raw.url || "", 280),
    priority: Number.isFinite(Number(raw.priority)) ? Number(raw.priority) : 99
  };
}

function normalizeWorldTourDate(rawDate) {
  if (!rawDate) return "";
  const text = String(rawDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function normalizeWorldTourStop(stop) {
  const raw = stop && typeof stop === "object" && !Array.isArray(stop) ? stop : {};
  const date = normalizeWorldTourDate(raw.date || raw.startDate);
  if (!date) return null;
  return {
    date,
    endDate: normalizeWorldTourDate(raw.endDate) || date,
    city: cleanTrackLabel(raw.city || "", 90),
    region: cleanTrackLabel(raw.region || raw.state || "", 90),
    country: cleanTrackLabel(raw.country || "", 90),
    venue: cleanTrackLabel(raw.venue || raw.name || "", 140),
    lat: Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : null,
    lon: Number.isFinite(Number(raw.lon)) ? Number(raw.lon) : null,
    source: normalizeWorldSource(raw.source || {})
  };
}

function normalizeWorldCandidate(raw, sourceOverride = null) {
  const item = raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const artistRaw = item.artist || item.band || {};
  const artistName = cleanTrackLabel(
    artistRaw.name || artistRaw.artist || item.artistName || item.bandName || item.name,
    100
  );
  if (!artistName) return null;
  const artistId = cleanTrackLabel(
    artistRaw.id || item.artistId || item.bandId || slugifyWorldId(artistName),
    80
  ) || slugifyWorldId(artistName);
  const source = normalizeWorldSource(sourceOverride || item.source || item.tour?.source || {});
  const albumRaw = item.album && typeof item.album === "object" && !Array.isArray(item.album) ? item.album : null;
  const tourRaw = item.tour && typeof item.tour === "object" && !Array.isArray(item.tour) ? item.tour : null;
  const tourDates = (Array.isArray(tourRaw?.dates) ? tourRaw.dates : Array.isArray(item.tourDates) ? item.tourDates : [])
    .map(normalizeWorldTourStop)
    .filter(Boolean);
  const nowIso = new Date().toISOString();
  const idSeed = [
    item.id,
    artistId,
    albumRaw?.title || item.albumTitle || "",
    tourRaw?.name || "",
    source.url || source.label
  ].filter(Boolean).join("|");

  const normalized = {
    id: cleanTrackLabel(item.id || `world-${stableHash(idSeed || artistId).toString(36)}`, 100),
    status: item.status === "approved" ? "approved" : "pending",
    kind: cleanTrackLabel(item.kind || (tourDates.length ? "tour" : albumRaw ? "album" : "artist"), 40),
    artist: {
      id: artistId,
      name: artistName,
      country: cleanTrackLabel(artistRaw.country || item.country || "", 90),
      city: cleanTrackLabel(artistRaw.city || item.city || "", 90),
      lat: Number.isFinite(Number(artistRaw.lat ?? item.lat)) ? Number(artistRaw.lat ?? item.lat) : null,
      lon: Number.isFinite(Number(artistRaw.lon ?? item.lon)) ? Number(artistRaw.lon ?? item.lon) : null
    },
    source,
    verifiedAt: item.verifiedAt || null,
    createdAt: item.createdAt || nowIso,
    updatedAt: nowIso
  };

  normalized.band = { ...normalized.artist };

  if (albumRaw) {
    normalized.album = {
      title: cleanTrackLabel(albumRaw.title || albumRaw.name || item.albumTitle || "", 120),
      year: cleanTrackLabel(albumRaw.year || item.year || "", 20),
      category: cleanTrackLabel(albumRaw.category || item.category || "", 40),
      lead: cleanTrackLabel(albumRaw.lead || item.lead || "", 120),
      tracks: normalizeStringArray(albumRaw.tracks || item.tracks, [], 24),
      salesM: Number.isFinite(Number(albumRaw.salesM ?? item.salesM)) ? Number(albumRaw.salesM ?? item.salesM) : null,
      grammyYear: cleanTrackLabel(albumRaw.grammyYear || item.grammyYear || "", 20),
      image: cleanTrackLabel(albumRaw.image || item.image || "", 280)
    };
  }

  if (tourDates.length) {
    normalized.tour = {
      name: cleanTrackLabel(tourRaw?.name || item.tourName || `${artistName} upcoming tour`, 140),
      dates: tourDates,
      source
    };
  }

  return normalized;
}

function futureWorldStops(stops, today = localDateKey()) {
  return (Array.isArray(stops) ? stops : [])
    .filter((stop) => normalizeWorldTourDate(stop.endDate || stop.date) >= today)
    .map((stop) => ({ ...stop, source: normalizeWorldSource(stop.source || {}) }));
}

function approvedWorldReviewItems() {
  return readWorldReviewFile(WORLD_APPROVED_FILE).items
    .map((item) => normalizeWorldCandidate(item))
    .filter((item) => item && item.status === "approved");
}

function countWorldTourStats(baseTours, approvedItems) {
  const today = localDateKey();
  const futureByBand = new Map();
  Object.entries(baseTours || {}).forEach(([bandId, tour]) => {
    const stops = futureWorldStops(tour?.stops || tour?.dates, today);
    if (stops.length) futureByBand.set(bandId, (futureByBand.get(bandId) || 0) + stops.length);
  });
  approvedItems.forEach((item) => {
    const stops = futureWorldStops(item.tour?.dates, today);
    if (stops.length) futureByBand.set(item.artist.id, (futureByBand.get(item.artist.id) || 0) + stops.length);
  });
  return {
    futureTourBands: futureByBand.size,
    futureTourStops: [...futureByBand.values()].reduce((sum, value) => sum + value, 0)
  };
}

function worldCatalogPayload(extra = {}) {
  const pendingFile = readWorldReviewFile(WORLD_PENDING_FILE);
  const approvedFile = readWorldReviewFile(WORLD_APPROVED_FILE);
  const globals = readPublicWorldGlobals();
  const pending = pendingFile.items
    .map((item) => normalizeWorldCandidate(item))
    .filter((item) => item && item.status === "pending");
  const approvedItems = approvedFile.items
    .map((item) => normalizeWorldCandidate(item))
    .filter((item) => item && item.status === "approved");
  const tourStats = countWorldTourStats(globals.tours, approvedItems);

  return {
    version: WORLD_CATALOG_VERSION,
    generatedAt: new Date().toISOString(),
    approved: {
      bands: globals.bands,
      tours: globals.tours,
      reviewItems: approvedItems
    },
    pending,
    providers: providerStatus(),
    stats: {
      bands: globals.bands.length,
      tourBands: Object.keys(globals.tours || {}).length,
      pending: pending.length,
      approvedReviewItems: approvedItems.length,
      ...tourStats
    },
    lastSyncPreview: pendingFile.lastSyncPreview || null,
    ...extra
  };
}

function upsertPendingWorldCandidates(rawCandidates, sourceOverride = null) {
  const file = readWorldReviewFile(WORLD_PENDING_FILE);
  const byId = new Map(file.items.map((item) => [String(item.id), item]));
  const normalized = (Array.isArray(rawCandidates) ? rawCandidates : [])
    .map((item) => normalizeWorldCandidate(item, sourceOverride))
    .filter(Boolean)
    .map((item) => ({ ...item, status: "pending", verifiedAt: null }));
  normalized.forEach((item) => byId.set(item.id, item));
  const next = {
    ...file,
    items: [...byId.values()],
    lastSyncPreview: {
      requestedAt: new Date().toISOString(),
      imported: normalized.length,
      providers: providerStatus()
    }
  };
  writeWorldReviewFile(WORLD_PENDING_FILE, next);
  return normalized;
}

function reviewWorldCandidate(candidateId, action, override = null) {
  const id = cleanTrackLabel(candidateId || "", 100);
  if (!id) throw new Error("Missing world candidate id");
  const pendingFile = readWorldReviewFile(WORLD_PENDING_FILE);
  const approvedFile = readWorldReviewFile(WORLD_APPROVED_FILE);
  const index = pendingFile.items.findIndex((item) => String(item.id) === id);
  if (index < 0 && !override) throw new Error(`World candidate not found: ${id}`);

  const base = override || pendingFile.items[index];
  const normalized = normalizeWorldCandidate(base);
  if (!normalized) throw new Error("Invalid world candidate");

  const remaining = pendingFile.items.filter((item) => String(item.id) !== id);
  writeWorldReviewFile(WORLD_PENDING_FILE, { ...pendingFile, items: remaining });

  if (action === "reject") {
    return { item: { ...normalized, status: "rejected", reviewedAt: new Date().toISOString() } };
  }

  const approvedItem = {
    ...normalized,
    status: "approved",
    verifiedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  const byId = new Map(approvedFile.items.map((item) => [String(item.id), item]));
  byId.set(approvedItem.id, approvedItem);
  writeWorldReviewFile(WORLD_APPROVED_FILE, { ...approvedFile, items: [...byId.values()] });
  return { item: approvedItem };
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

function markdownList(items) {
  const list = normalizeStringArray(items, [], 120);
  return list.length ? list.map((item) => `- ${item}`).join("\n") : "- none";
}

function markdownMap(map) {
  const entries = Object.entries(map && typeof map === "object" && !Array.isArray(map) ? map : {});
  return entries.length
    ? entries.map(([key, value]) => `- ${key}: ${value}`).join("\n")
    : "- none";
}

function markdownTimePreferences(timePreferences) {
  const source = timePreferences && typeof timePreferences === "object" && !Array.isArray(timePreferences)
    ? timePreferences
    : {};
  const entries = Object.entries(source);
  if (!entries.length) return "- none";
  return entries.map(([part, preference]) => {
    const genres = normalizeStringArray(preference?.genres, [], 24).join(", ") || "open";
    const boost = Number.isFinite(Number(preference?.boost)) ? Number(preference.boost) : 0;
    return `- ${part}: ${genres} (boost ${boost})`;
  }).join("\n");
}

function profileToTasteMarkdown(profile) {
  return [
    "# RadioX DJ Taste",
    "",
    `Station: ${profile.stationName || "RadioX"}`,
    `Listener: ${profile.nickname || "老朋友"}`,
    profile.tagline ? `Tagline: ${profile.tagline}` : "",
    "",
    "Taste anchors:",
    markdownList(profile.tasteAnchors),
    "",
    "Current lean:",
    markdownList(profile.currentLean),
    "",
    "Genre weights:",
    markdownMap(profile.genreWeights),
    "",
    "Era bias:",
    markdownMap(profile.eraBias),
    "",
    "Time preferences:",
    markdownTimePreferences(profile.timePreferences),
    "",
    "DJ rule:",
    "- Use weather, mood, and schedule pressure as context.",
    "- Do not flatten taste into one genre.",
    "- Let old electricity and current calm coexist.",
    ""
  ].filter((line) => line !== "").join("\n");
}

function writeTasteMarkdown(profile) {
  fs.writeFileSync(path.join(DATA_DIR, "taste.md"), `${profileToTasteMarkdown(profile)}\n`);
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

function inferIntensity(baseIntensity, tags, now) {
  let value = Number(baseIntensity);
  if (!Number.isFinite(value)) value = 2;
  const tagSet = new Set(tags || []);

  if (tagSet.has("meetings") || tagSet.has("training")) value = Math.max(value, 4);
  if (tagSet.has("focus")) value = Math.max(value, now.dayPart === "workday" ? 3 : 2);
  if (tagSet.has("family") || tagSet.has("social")) value = Math.max(value, 3);
  if (tagSet.has("bright")) value = Math.max(value, 3);
  if (tagSet.has("recovery") && !tagSet.has("bright")) value = Math.min(value, 2);

  return clamp(value, 1, 5);
}

function openWeatherConfigured() {
  return Boolean(OPENWEATHER_API_KEY && Number.isFinite(OPENWEATHER_LAT) && Number.isFinite(OPENWEATHER_LON));
}

function uniqueList(items) {
  return [...new Set((items || []).filter(Boolean))];
}

function tagsFromOpenWeather(body) {
  const weather = body?.weather?.[0] || {};
  const id = Number(weather.id || 0);
  const main = normalizeTerm(weather.main);
  const temp = Number(body?.main?.temp);
  const windSpeed = Number(body?.wind?.speed || 0);
  const cloudCover = Number(body?.clouds?.all || 0);
  const tags = [];

  if ((id >= 200 && id < 600) || ["thunderstorm", "drizzle", "rain"].includes(main)) tags.push("rain");
  if ((id >= 600 && id < 700) || main === "snow" || (Number.isFinite(temp) && temp <= 8)) tags.push("cold");
  if (Number.isFinite(temp) && temp >= 28) tags.push("hot");
  if (windSpeed >= 8) tags.push("windy");
  if (id === 800 && cloudCover < 45) tags.push("clear");
  if ((id > 800 && id < 900) || main === "clouds" || cloudCover >= 45) tags.push("cloudy");

  return uniqueList(tags).length ? uniqueList(tags) : ["clear"];
}

function normalizeOpenWeatherPayload(body) {
  const tags = tagsFromOpenWeather(body);
  const weather = body?.weather?.[0] || {};
  const observedAt = Number.isFinite(Number(body?.dt))
    ? new Date(Number(body.dt) * 1000).toISOString()
    : null;
  return {
    source: "openweather",
    tag: tags[0],
    tags,
    location: OPENWEATHER_LOCATION_LABEL || body?.name || `${OPENWEATHER_LAT},${OPENWEATHER_LON}`,
    description: weather.description || weather.main || tags[0],
    main: weather.main || "",
    conditionId: weather.id || null,
    icon: weather.icon || "",
    temp: Number.isFinite(Number(body?.main?.temp)) ? Number(body.main.temp) : null,
    feelsLike: Number.isFinite(Number(body?.main?.feels_like)) ? Number(body.main.feels_like) : null,
    humidity: Number.isFinite(Number(body?.main?.humidity)) ? Number(body.main.humidity) : null,
    windSpeed: Number.isFinite(Number(body?.wind?.speed)) ? Number(body.wind.speed) : null,
    clouds: Number.isFinite(Number(body?.clouds?.all)) ? Number(body.clouds.all) : null,
    units: OPENWEATHER_UNITS,
    observedAt,
    fetchedAt: new Date().toISOString()
  };
}

async function refreshOpenWeatherCache(force = false) {
  if (!openWeatherConfigured()) return null;
  const age = Date.now() - openWeatherCache.fetchedAt;
  if (!force && openWeatherCache.value && age < OPENWEATHER_CACHE_MS) return openWeatherCache.value;
  if (openWeatherCache.pending) return openWeatherCache.pending;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENWEATHER_TIMEOUT_MS);
  const endpoint = new URL("https://api.openweathermap.org/data/2.5/weather");
  endpoint.searchParams.set("lat", String(OPENWEATHER_LAT));
  endpoint.searchParams.set("lon", String(OPENWEATHER_LON));
  endpoint.searchParams.set("appid", OPENWEATHER_API_KEY);
  endpoint.searchParams.set("units", OPENWEATHER_UNITS);
  endpoint.searchParams.set("lang", OPENWEATHER_LANG);

  openWeatherCache.pending = fetch(endpoint, { signal: controller.signal })
    .then(async (response) => {
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(`OpenWeather ${response.status}: ${body.message || response.statusText}`);
      }
      const normalized = normalizeOpenWeatherPayload(body);
      openWeatherCache.value = normalized;
      openWeatherCache.fetchedAt = Date.now();
      openWeatherCache.lastError = "";
      return normalized;
    })
    .catch((error) => {
      openWeatherCache.lastError = error.message;
      console.warn("OpenWeather refresh failed", error.message);
      return openWeatherCache.value;
    })
    .finally(() => {
      clearTimeout(timer);
      openWeatherCache.pending = null;
    });

  return openWeatherCache.pending;
}

function scheduleOpenWeatherRefresh() {
  if (!openWeatherConfigured()) return;
  const age = Date.now() - openWeatherCache.fetchedAt;
  if (!openWeatherCache.value || age >= OPENWEATHER_CACHE_MS) {
    refreshOpenWeatherCache(false).catch(() => {});
  }
}

function cachedOpenWeather() {
  scheduleOpenWeatherRefresh();
  return openWeatherCache.value;
}

function contextVector(state, routines) {
  const now = nowParts();
  const today = routines.days[now.weekday] || routines.default;
  const useManual = freshManualContext(state, now);
  const plan = useManual && state.planText ? state.planText : today.planText || routines.default.planText;
  const tags = scheduleTags(plan);
  const openWeather = !useManual ? cachedOpenWeather() : null;
  const cachedWeather = useManual ? cachedOpenWeather() : openWeather;
  const fallbackWeather = today.weather || routines.default.weather;
  const useManualWeather = useManual && state.weather && (state.weatherManual === true || !cachedWeather);
  const weather = useManualWeather
    ? state.weather
    : cachedWeather?.tag || fallbackWeather;
  const weatherTags = useManualWeather
    ? [state.weather]
    : cachedWeather?.tags || [weather];
  const weatherSource = useManualWeather
    ? "manual"
    : cachedWeather
      ? "openweather"
      : "routine";
  const mood = useManual && state.mood ? state.mood : today.mood || routines.default.mood;
  const rawIntensity = Number(useManual && state.intensity != null ? state.intensity : today.intensity ?? routines.default.intensity);
  const intensity = useManual ? clamp(rawIntensity, 1, 5) : inferIntensity(rawIntensity, tags, now);

  return {
    now,
    planText: plan,
    scheduleTags: tags,
    weather,
    weatherTags,
    weatherSource,
    weatherDetail: useManualWeather ? null : cachedWeather,
    mood,
    intensity
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

function normalizeTrackSearchText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[＆]/g, "&")
    .replace(/[‐-―−]/g, "-")
    .replace(/[^\p{L}\p{N}&+]+/gu, " ")
    .trim();
}

function cleanTrackLabel(value, maxLength = 90) {
  return String(value || "")
    .normalize("NFKC")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .replace(/^[《「『“”"'\s]+|[》」』“”"'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeCustomTrack(track) {
  const title = cleanTrackLabel(track?.title);
  if (!title) return null;
  const artist = cleanTrackLabel(track?.artist || "Spotify Request", 80);
  const id = String(track?.id || `request-${stableHash(`${title}|${artist}`).toString(36)}`).trim();
  const next = {
    id: id.startsWith("request-") ? id : `request-${stableHash(id).toString(36)}`,
    title,
    artist,
    query: cleanTrackLabel(track?.query || `${title} ${artist === "Spotify Request" ? "" : artist}`, 140) || title,
    genres: normalizeStringArray(track?.genres, ["listener-request"], 8),
    moods: normalizeStringArray(track?.moods, ["focus"], 8),
    weather: normalizeStringArray(track?.weather, ["clear", "cloudy", "rain"], 8),
    dayParts: normalizeStringArray(track?.dayParts, ["morning", "workday", "dusk", "night", "deep-night"], 8),
    scheduleTags: normalizeStringArray(track?.scheduleTags, ["open"], 8),
    energy: Math.round(clamp(Number(track?.energy ?? 50), 15, 90)),
    era: cleanTrackLabel(track?.era || "middle-calm", 40),
    duration: Math.round(clamp(Number(track?.duration ?? 240), 90, 900)),
    requestedAt: track?.requestedAt || new Date().toISOString()
  };
  next.story = track?.story || {
    headline: "对话里点进来的歌",
    text: `${next.artist === "Spotify Request" ? next.title : `${next.artist} 的 ${next.title}`} 是你刚刚在对话里点名想听的歌。RadioX 会先排进队列，再让 Spotify 找最合适的版本。`
  };
  return next;
}

function normalizeCustomTracks(value) {
  const byId = new Map();
  (Array.isArray(value) ? value : [])
    .map(normalizeCustomTrack)
    .filter(Boolean)
    .forEach((track) => byId.set(track.id, track));
  return [...byId.values()].slice(-REQUESTED_TRACK_LIMIT);
}

function normalizeDiscoveryTrack(track, context) {
  const title = cleanTrackLabel(track?.title);
  const artist = cleanTrackLabel(track?.artist, 80);
  if (!title || !artist) return null;
  const id = String(track?.id || `discovery-${stableHash(`${title}|${artist}`).toString(36)}`).trim();
  return {
    id: id.startsWith("discovery-") ? id : `discovery-${stableHash(id).toString(36)}`,
    title,
    artist,
    query: cleanTrackLabel(track?.query || `${title} ${artist}`, 140),
    genres: normalizeStringArray(track?.genres, ["open"], 8),
    moods: normalizeStringArray(track?.moods, [context?.mood || "focus"], 8),
    weather: normalizeStringArray(track?.weather, context?.weatherTags || ["clear", "cloudy", "rain"], 8),
    dayParts: normalizeStringArray(track?.dayParts, [context?.now?.dayPart || "workday"], 8),
    scheduleTags: normalizeStringArray(track?.scheduleTags, context?.scheduleTags || ["open"], 8),
    energy: Math.round(clamp(Number(track?.energy ?? contextTargetEnergy(context || { mood: "focus", scheduleTags: [], intensity: 3 })), 12, 92)),
    era: cleanTrackLabel(track?.era || "middle-calm", 40),
    duration: Math.round(clamp(Number(track?.duration ?? 260), 90, 900)),
    discoveredAt: track?.discoveredAt || new Date().toISOString(),
    discoverySource: cleanTrackLabel(track?.discoverySource || "taste-map", 40),
    story: track?.story || {
      headline: "RadioX 自动发现",
      text: `${artist} 的 ${title} 是 RadioX 根据你的 taste map 自动扩展进来的候选曲，先放进曲库，让 Spotify 负责找到真实版本。`
    }
  };
}

function normalizeDiscoveryTracks(value, context) {
  const byId = new Map();
  (Array.isArray(value) ? value : [])
    .map((track) => normalizeDiscoveryTrack(track, context))
    .filter(Boolean)
    .forEach((track) => byId.set(track.id, track));
  return [...byId.values()].slice(-DISCOVERY_TRACK_LIMIT);
}

function mergeCatalogTracks(baseCatalog, customTracks) {
  const byId = new Map();
  (baseCatalog || []).forEach((track) => byId.set(track.id, track));
  normalizeDiscoveryTracks(customTracks?.discoveryTracks, customTracks?.context).forEach((track) => byId.set(track.id, track));
  normalizeCustomTracks(customTracks?.customTracks || customTracks).forEach((track) => byId.set(track.id, track));
  return [...byId.values()];
}

function readBaseCatalog() {
  const stories = readJson("song-stories.json");
  return attachTrackStories(readJson("playlist-catalog.json"), stories);
}

function readStationCatalog(state, context = null) {
  const baseCatalog = readBaseCatalog();
  return mergeCatalogTracks(baseCatalog, {
    customTracks: state?.customTracks,
    discoveryTracks: state?.discoveryTracks,
    context
  });
}

function trackMentionScore(track, rawTitle) {
  const target = normalizeTrackSearchText(rawTitle);
  if (!target) return 0;
  const title = normalizeTrackSearchText(track.title);
  const artist = normalizeTrackSearchText(track.artist);
  const query = normalizeTrackSearchText(track.query);
  if (target === title) return 120;
  if (target === query) return 110;
  if (target.includes(title) && title.length >= 3) return 95;
  if (title.includes(target) && target.length >= 3) return 82;
  if (query.includes(target) && target.length >= 3) return 70;
  if (target.includes(artist) && target.includes(title) && title.length >= 3) return 105;
  return 0;
}

function findBestCatalogTrack(rawTitle, catalog) {
  let best = null;
  let bestScore = 0;
  (catalog || []).forEach((track) => {
    const score = trackMentionScore(track, rawTitle);
    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  });
  return bestScore >= 70 ? best : null;
}

function knownArtistSet(catalog, profile) {
  const names = new Set();
  (catalog || []).forEach((track) => {
    String(track.artist || "")
      .split(/&|,|，|\/| and /i)
      .map(normalizeTrackSearchText)
      .filter(Boolean)
      .forEach((name) => names.add(name));
  });
  (profile?.tasteAnchors || [])
    .map(normalizeTrackSearchText)
    .filter(Boolean)
    .forEach((name) => names.add(name));
  return names;
}

function hasQueueRequestIntent(text) {
  return /(想听|想放|想播|播放|来一首|来首|点一首|点首|听一下|听听|加入|加到|放进|排进|添加到|queue|Queue|歌单|队列|播放列表)/.test(text);
}

function extractQuotedTrackNames(text) {
  const names = [];
  const seen = new Set();
  const pattern = /[《「『“"]([^《》「」『』“”"]{1,90})[》」』”"]/g;
  let match = pattern.exec(text);
  while (match) {
    const title = cleanTrackLabel(match[1]);
    const key = normalizeTrackSearchText(title);
    if (title && !seen.has(key)) {
      seen.add(key);
      names.push({ title, quoted: true });
    }
    match = pattern.exec(text);
  }
  return names;
}

function cleanRequestFragment(value) {
  return cleanTrackLabel(value, 120)
    .replace(/^(?:一下|一首|这首|这首歌|歌曲|歌)\s*/i, "")
    .replace(/(?:加入|加到|放进|排进|添加到)?\s*(?:播放)?\s*(?:queue|歌单|队列|播放列表|列表).*$/i, "")
    .replace(/(?:吧|呀|吗|嘛|可以吗|好不好)$/i, "")
    .trim();
}

function splitRequestFragment(value) {
  return cleanRequestFragment(value)
    .split(/(?:和|还有|以及|、|，|,|\/)+/)
    .map(cleanRequestFragment)
    .filter(Boolean);
}

function extractRequestFragments(text) {
  const fragments = [];
  const patterns = [
    /(?:想听|想放|想播|播放|来一首|来首|点一首|点首|听一下|听听)\s*([^。！？!?；;\n]{2,120})/gi,
    /把\s*([^。！？!?；;\n]{2,160}?)(?:加入|加到|放进|排进|添加到)/gi,
    /(?:加入|加到|放进|排进|添加到)(?!\s*(?:播放)?\s*(?:queue|歌单|队列|播放列表|列表))\s*([^。！？!?；;\n]{2,120})/gi
  ];
  patterns.forEach((pattern) => {
    let match = pattern.exec(text);
    while (match) {
      fragments.push(...splitRequestFragment(match[1]));
      match = pattern.exec(text);
    }
  });
  return fragments;
}

function parseTrackCandidate(value) {
  const text = cleanRequestFragment(value);
  if (!text) return null;
  const possessive = text.match(/^(.{1,42}?)(?:的|の)\s*(.{2,90})$/);
  if (possessive && !/^(?:我|你|他|她|它|这首|那首|类似|其他)$/i.test(cleanTrackLabel(possessive[1]))) {
    return {
      artist: cleanTrackLabel(possessive[1], 80),
      title: cleanTrackLabel(possessive[2])
    };
  }
  const byMatch = text.match(/^(.{2,90}?)\s+(?:by|from)\s+(.{2,80})$/i);
  if (byMatch) {
    return {
      title: cleanTrackLabel(byMatch[1]),
      artist: cleanTrackLabel(byMatch[2], 80)
    };
  }
  return { title: text, artist: "" };
}

function isGenericTrackCandidate(candidate, artists) {
  const title = normalizeTrackSearchText(candidate?.title);
  if (!title || title.length < 2) return true;
  if (/^(?:song|songs|music|track|queue|playlist|list|play|歌|歌曲|音乐|这首|这首歌|那首|一首|类似|其他|风格|推荐|歌单|队列|列表|播放列表)$/.test(title)) return true;
  if (!candidate.artist && artists.has(title)) return true;
  return false;
}

function buildRequestedTrack(candidate, context) {
  const title = cleanTrackLabel(candidate?.title);
  if (!title) return null;
  const artist = cleanTrackLabel(candidate?.artist || "Spotify Request", 80);
  return normalizeCustomTrack({
    title,
    artist,
    query: artist === "Spotify Request" ? title : `${title} ${artist}`,
    genres: ["listener-request"],
    moods: [context?.mood || "focus"],
    weather: context?.weatherTags || [context?.weather || "clear"],
    dayParts: [context?.now?.dayPart || "workday"],
    scheduleTags: context?.scheduleTags || ["open"],
    energy: context ? contextTargetEnergy(context) : 50,
    story: {
      headline: "对话里点进来的歌",
      text: `${artist === "Spotify Request" ? title : `${artist} 的 ${title}`} 是你刚刚在对话里点名想听的歌。RadioX 会先排进队列，再让 Spotify 找最合适的版本。`
    }
  });
}

function candidateToTrack(candidate, catalog, profile, context) {
  if (!candidate?.title) return null;
  const best = findBestCatalogTrack(`${candidate.title} ${candidate.artist || ""}`, catalog)
    || findBestCatalogTrack(candidate.title, catalog);
  if (best) return best;
  if (isGenericTrackCandidate(candidate, knownArtistSet(catalog, profile))) return null;
  return buildRequestedTrack(candidate, context);
}

function findCatalogTrackMentions(text, catalog) {
  const normalizedText = normalizeTrackSearchText(text);
  return (catalog || [])
    .map((track) => {
      const title = normalizeTrackSearchText(track.title);
      const artist = normalizeTrackSearchText(track.artist);
      const query = normalizeTrackSearchText(track.query);
      const indexes = [title, query, `${artist} ${title}`]
        .filter((value) => value && value.length >= 3)
        .map((value) => normalizedText.indexOf(value))
        .filter((index) => index >= 0);
      return indexes.length ? { track, index: Math.min(...indexes), size: title.length } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.index - b.index || b.size - a.size)
    .map((item) => item.track);
}

function extractChatTrackRequests(text, catalog, profile, context) {
  if (!hasQueueRequestIntent(text)) return [];
  const byId = new Map();
  const addTrack = (track) => {
    if (!track?.id || byId.has(track.id)) return;
    byId.set(track.id, track);
  };

  findCatalogTrackMentions(text, catalog).forEach(addTrack);
  extractQuotedTrackNames(text).forEach((candidate) => {
    addTrack(candidateToTrack(candidate, catalog, profile, context));
  });
  extractRequestFragments(text)
    .map(parseTrackCandidate)
    .forEach((candidate) => addTrack(candidateToTrack(candidate, catalog, profile, context)));

  return [...byId.values()].slice(0, CHAT_QUEUE_INSERT_LIMIT);
}

function mergeCustomStateTracks(existing, additions) {
  const byId = new Map();
  normalizeCustomTracks(existing).forEach((track) => byId.set(track.id, track));
  (additions || [])
    .filter((track) => String(track.id || "").startsWith("request-"))
    .map(normalizeCustomTrack)
    .filter(Boolean)
    .forEach((track) => byId.set(track.id, track));
  return [...byId.values()].slice(-REQUESTED_TRACK_LIMIT);
}

function trimQueueOrder(order, currentId, protectedIds) {
  const protectedSet = new Set([currentId, ...(protectedIds || [])].filter(Boolean));
  const seen = new Set();
  const next = (order || []).filter((id) => {
    const value = String(id || "").trim();
    if (!value || seen.has(value)) return false;
    seen.add(value);
    return true;
  });
  for (let index = next.length - 1; next.length > QUEUE_SIZE && index >= 0; index -= 1) {
    if (!protectedSet.has(next[index])) next.splice(index, 1);
  }
  return next.slice(0, QUEUE_SIZE);
}

function applyChatQueueRequests(state, payload, requestedTracks) {
  const tracks = (requestedTracks || []).filter(Boolean).slice(0, CHAT_QUEUE_INSERT_LIMIT);
  if (!tracks.length) return { state, added: [], changed: false };

  const currentId = payload.current?.id || payload.queue?.[payload.state?.currentIndex || 0]?.id || "";
  const currentOrder = Array.isArray(payload.state?.queueOrder) && payload.state.queueOrder.length
    ? payload.state.queueOrder
    : (payload.queue || []).map((track) => track.id);
  const requestedIds = tracks.map((track) => track.id).filter(Boolean);
  const idsToInsert = requestedIds.filter((id) => id !== currentId);
  const withoutRequested = currentOrder.filter((id) => !idsToInsert.includes(id));
  const anchorIndex = currentId && withoutRequested.includes(currentId)
    ? withoutRequested.indexOf(currentId) + 1
    : Math.min(Number(payload.state?.currentIndex || 0) + 1, withoutRequested.length);
  const nextOrder = trimQueueOrder([
    ...withoutRequested.slice(0, anchorIndex),
    ...idsToInsert,
    ...withoutRequested.slice(anchorIndex)
  ], currentId, requestedIds);
  const nextCurrentIndex = currentId && nextOrder.includes(currentId)
    ? nextOrder.indexOf(currentId)
    : 0;
  const changed = nextOrder.join("|") !== currentOrder.join("|")
    || tracks.some((track) => String(track.id || "").startsWith("request-"));

  if (!changed) return { state, added: [], changed: false };
  return {
    state: {
      ...state,
      customTracks: mergeCustomStateTracks(state.customTracks, tracks),
      currentIndex: nextCurrentIndex,
      queueDate: localDateKey(),
      queueSignature: payload.state?.queueSignature || contextSignature(payload.context, payload.profile, state),
      queueOrder: nextOrder,
      updatedAt: new Date().toISOString()
    },
    added: tracks,
    changed: true
  };
}

function appendQueueConfirmation(replyText, addedTracks) {
  const tracks = (addedTracks || []).filter(Boolean);
  if (!tracks.length) return replyText;
  const names = tracks
    .slice(0, 3)
    .map((track) => `《${track.title}》`)
    .join("、");
  const suffix = tracks.length > 3
    ? `我已经把${names}等几首歌放进 Queue，排在当前曲目后面。`
    : `我已经把${names}放进 Queue，排在当前曲目后面。`;
  if (/放进\s*Queue|加入\s*Queue|排进\s*Queue|队列/.test(replyText)) return replyText;
  return normalizeChatText(`${replyText} ${suffix}`, 1000);
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

function trackIdentityKey(track) {
  return [
    normalizeTrackSearchText(track?.title),
    normalizeTrackSearchText(track?.artist)
  ].filter(Boolean).join("::");
}

function freshTrackCount(catalog, state, context) {
  const recentIds = recentAvoidIds(state);
  const weeklyIds = weeklyAvoidIds(state, context);
  return (catalog || []).filter((track) => !recentIds.has(track.id) && !weeklyIds.has(track.id)).length;
}

function seedMatchesTaste(seed, profile) {
  const text = normalizeTrackSearchText([
    seed.title,
    seed.artist,
    seed.query,
    ...(seed.genres || [])
  ].join(" "));
  const anchors = [
    ...(profile.tasteAnchors || []),
    ...(profile.currentLean || []),
    ...Object.keys(profile.genreWeights || {})
  ].map(normalizeTrackSearchText).filter(Boolean);
  return anchors.some((anchor) => anchor.length >= 3 && (text.includes(anchor) || anchor.includes(text)));
}

function scoreDiscoverySeed(track, profile, context, state) {
  let score = scoreTrack(track, context, profile);
  score += dailyRotation(track, context, { ...state, queueGeneration: queueGeneration(state) + 1 });
  score -= recommendationHistoryPenalty(track, state, context);
  if (seedMatchesTaste(track, profile)) score += 12;
  if (["night", "deep-night"].includes(context.now.dayPart) && hasGenre(track, ["classical", "jazz", "blues", "neo-classical"])) score += 10;
  if (context.scheduleTags.includes("focus") && hasGenre(track, ["jazz", "classical", "neo-classical", "progressive-rock"])) score += 6;
  return score;
}

function growDiscoveryCatalogIfNeeded(profile, state, context) {
  const baseCatalog = readBaseCatalog();
  const existingDiscovery = normalizeDiscoveryTracks(state.discoveryTracks, context);
  const merged = mergeCatalogTracks(baseCatalog, {
    customTracks: state.customTracks,
    discoveryTracks: existingDiscovery,
    context
  });
  const freshCount = freshTrackCount(merged, state, context);
  if (freshCount >= DISCOVERY_MIN_FRESH_TRACKS) return { state, grown: false, added: [] };

  const identityKeys = new Set(merged.map(trackIdentityKey).filter(Boolean));
  const seeds = readOptionalJson("discovery-seeds.json", [])
    .map((seed) => normalizeDiscoveryTrack(seed, context))
    .filter(Boolean)
    .filter((track) => !identityKeys.has(trackIdentityKey(track)));

  if (!seeds.length) return { state, grown: false, added: [] };

  const added = seeds
    .map((track) => ({
      track,
      score: scoreDiscoverySeed(track, profile, context, state)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, DISCOVERY_BATCH_SIZE)
    .map(({ track }) => ({
      ...track,
      discoveredAt: new Date().toISOString()
    }));

  if (!added.length) return { state, grown: false, added: [] };

  return {
    state: {
      ...state,
      discoveryTracks: normalizeDiscoveryTracks([...existingDiscovery, ...added], context),
      discoveryGeneration: Number(state.discoveryGeneration || 0) + 1,
      queueGeneration: queueGeneration(state) + 1,
      queueSignature: null,
      queueOrder: [],
      currentIndex: 0,
      updatedAt: new Date().toISOString()
    },
    grown: true,
    added
  };
}

function rememberLimited(map, key, value, limit) {
  if (!key || !value) return;
  map.set(key, value);
  if (map.size <= limit) return;
  const oldestKey = map.keys().next().value;
  map.delete(oldestKey);
}

function queueGeneration(state) {
  const value = Number(state?.queueGeneration || 0);
  return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0;
}

function dailyRotation(track, context, state) {
  const generation = queueGeneration(state);
  const hash = stableHash(`${context.now.dateKey}:${context.now.dayPart}:${generation}:${track.id}`);
  return Math.round((((hash % 2000) / 1000) - 1) * 90) / 10;
}

function contextSignature(context, profile, state = {}) {
  const activeTimePreference = profile.timePreferences?.[context.now.dayPart] || {};
  return String(stableHash([
    RECOMMENDATION_ENGINE_VERSION,
    queueGeneration(state),
    context.now.dateKey,
    context.now.dayPart,
    context.weather,
    (context.weatherTags || []).join(","),
    context.weatherSource || "",
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

function recommendationHistoryPenalty(track, state, context) {
  const history = pruneRecommendationHistory(state.recommendationHistory, context.now.dateKey);
  const dateKey = history[track.id];
  if (!dateKey) return 0;
  const age = daysBetweenDateKeys(context.now.dateKey, dateKey);
  if (age <= 0) return 42;
  if (age <= 2) return 34;
  if (age <= 4) return 24;
  return 16;
}

function requestTrackPenalty(track) {
  const isRequest = String(track.id || "").startsWith("request-") || hasGenre(track, ["listener-request"]);
  return isRequest ? 18 : 0;
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

function laneKey(track) {
  if (hasGenre(track, ["classical", "neo-classical"])) return "classical";
  if (hasGenre(track, ["jazz"])) return "jazz";
  if (hasGenre(track, ["blues"])) return "blues";
  if (hasGenre(track, ["mandarin-rock", "folk-rock"])) return "mandarin";
  if (hasGenre(track, ["j-rock"])) return "j-rock";
  if (hasGenre(track, ["metal", "hard-rock", "classic-rock", "grunge", "punk", "alternative-rock", "progressive-rock"])) return "rock";
  if (hasGenre(track, ["pop-vocal"])) return "vocal";
  if (hasGenre(track, ["listener-request"])) return "request";
  return "open";
}

function laneLimitFor(context, lane) {
  if (["jazz", "blues", "classical"].includes(lane) && ["night", "deep-night"].includes(context.now.dayPart)) return 3;
  if (lane === "rock" && context.intensity >= 4) return 4;
  if (lane === "request") return 2;
  return 2;
}

function selectDiverseTracks(scored, limit, context, initial = []) {
  const selected = [...initial];
  const selectedIds = new Set(selected.map((track) => track.id));
  const artistCounts = new Map();
  const laneCounts = new Map();

  selected.forEach((track) => {
    const artist = artistKey(track.artist);
    const lane = laneKey(track);
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    laneCounts.set(lane, (laneCounts.get(lane) || 0) + 1);
  });

  const passes = [
    { artistLimit: 1, laneRelax: 0 },
    { artistLimit: 1, laneRelax: 1 },
    { artistLimit: 2, laneRelax: 1 },
    { artistLimit: 99, laneRelax: 99 }
  ];

  for (const pass of passes) {
    for (const track of scored) {
      if (selectedIds.has(track.id)) continue;
      const artist = artistKey(track.artist);
      const lane = laneKey(track);
      const artistCount = artistCounts.get(artist) || 0;
      const laneCount = laneCounts.get(lane) || 0;
      if (artistCount >= pass.artistLimit) continue;
      if (laneCount >= laneLimitFor(context, lane) + pass.laneRelax) continue;
      selected.push(track);
      selectedIds.add(track.id);
      artistCounts.set(artist, artistCount + 1);
      laneCounts.set(lane, laneCount + 1);
      if (selected.length >= limit) return selected;
    }
  }

  return selected;
}

function recentAvoidIds(state) {
  return new Set((state.history || []).slice(-RECENT_AVOID_COUNT));
}

function scoreTrack(track, context, profile) {
  let score = 0;
  if (track.moods?.includes(context.mood)) score += 26;
  if (overlaps(track.weather, context.weatherTags || [context.weather])) score += 14;
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
  if ((context.weatherTags || [context.weather]).includes("rain") && (track.genres || []).includes("jazz")) score += 5;
  if ((context.weatherTags || [context.weather]).includes("clear") && (track.genres || []).includes("classic-rock")) score += 4;
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
    score: scoreTrack(track, context, profile)
      + dailyRotation(track, context, state)
      - recentPenalty(track, state)
      - recommendationHistoryPenalty(track, state, context)
      - requestTrackPenalty(track),
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
  const selected = selectDiverseTracks(strictFresh, QUEUE_SIZE, context);
  if (selected.length >= QUEUE_SIZE) return selected;

  const weekFresh = scored.filter((track) => !weeklyIds.has(track.id));
  const withWeekFresh = selectDiverseTracks(weekFresh, QUEUE_SIZE, context, selected);
  if (withWeekFresh.length >= QUEUE_SIZE) return withWeekFresh;

  const recentlyFresh = scored.filter((track) => !recentIds.has(track.id));
  const withRecentFresh = selectDiverseTracks(recentlyFresh, QUEUE_SIZE, context, withWeekFresh);
  if (withRecentFresh.length >= QUEUE_SIZE) return withRecentFresh;

  return selectDiverseTracks(scored, QUEUE_SIZE, context, withRecentFresh);
}

function queueFromOrder(order, catalog, context, profile, state) {
  const byId = new Map(catalog.map((track) => [track.id, track]));
  return (order || [])
    .map((id) => byId.get(id))
    .filter(Boolean)
    .map((track) => decorateTrack(track, context, profile, state));
}

function resolveQueue(profile, catalog, context, state) {
  const signature = contextSignature(context, profile, state);
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

function pickReasonLine(track, lines, salt = "") {
  if (!Array.isArray(lines) || !lines.length) return "";
  const index = Math.abs(stableHash(`${track.id || track.title}-${salt}`)) % lines.length;
  return lines[index];
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

  const moodLine = pickReasonLine(track, {
    breath: [
      "现在更适合把节奏放慢一点，让身体先跟上耳朵",
      "它不会催你立刻精神起来，只留出一点安静的余量"
    ],
    focus: [
      "它能给专注一个稳定的底盘，又不会抢走你正在处理的事情",
      "节奏在旁边轻轻托着，适合继续做事，也适合慢慢收尾"
    ],
    blue: [
      "它不急着解释情绪，只让声音把今晚的重量慢慢摊开",
      "这种慢下来的旋律，适合把心里杂乱的部分一点点放平"
    ],
    recover: [
      "它会把白天的噪声往后放，让恢复这件事变得没那么用力",
      "声音不往前逼人，比较适合让一天慢慢降下来"
    ],
    drive: [
      "它有一点往前走的推力，但不会把人推到失控的位置",
      "鼓点给人一点步子，适合从疲惫里重新找回方向"
    ],
    fire: [
      "它把年轻时那股电流拿出来，却不只是靠音量取胜",
      "吉他和人声还带着火，但现在听起来多了一层回望"
    ]
  }[context.mood] || [
    "它跟你现在的状态有一段距离刚好的靠近",
    "它不会替你定义心情，只把声音放在合适的位置"
  ], context.mood || "default");

  const genericStoryHeadlines = new Set(["RadioX crate note", "RadioX 自动发现", "对话里点进来的歌"]);
  const storyLine = track.story?.headline && !genericStoryHeadlines.has(track.story.headline)
    ? `这首歌的线索在“${track.story.headline}”里，听起来会比单纯的风格标签更有来处`
    : `${track.artist} 在这里不是一个标签，更像今晚声音颜色的一部分`;

  return `${genreLine}。${moodLine}。${storyLine}。`;
}

function openAiConfigured() {
  return Boolean(process.env.OPENAI_API_KEY);
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
      weatherSource: context.weatherSource,
      weatherTags: context.weatherTags,
      weatherDetail: context.weatherDetail,
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
          "你是 RadioX，一个私人电台 DJ，只和一位熟悉的听众聊天。",
          "用中文回答。像老友在音乐声里聊天，温暖、自然、具体，不要客服腔，不要长篇教学。",
          "不要每次回复都用“老朋友”开头。默认直接回应用户的话；只有用户主动称呼你，或情绪特别需要安抚时，才可以偶尔称呼一次。",
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

function stationPayload(options = {}) {
  const profile = readJson("profile.json");
  const routines = readJson("routines.json");
  let state = readJson("state.json");
  const context = contextVector(state, routines);
  state = seedRecommendationHistory(state, context);
  const discovery = options.persistQueue ? growDiscoveryCatalogIfNeeded(profile, state, context) : { state, grown: false, added: [] };
  if (discovery.grown) {
    state = discovery.state;
    writeJson("state.json", state);
  }
  const catalog = readStationCatalog(state, context);
  let queueState = resolveQueue(profile, catalog, context, state);
  const storedIndex = Number(state.currentIndex || 0);
  const queueExhausted = !queueState.stale && queueState.queue.length > 0 && storedIndex >= queueState.queue.length;

  if (options.persistQueue && queueExhausted) {
    state = {
      ...state,
      currentIndex: 0,
      queueGeneration: queueGeneration(state) + 1,
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
      queueGeneration: queueGeneration(state),
      updatedAt: new Date().toISOString()
    };
    writeJson("state.json", state);
  }

  const queue = queueState.queue;
  const rawIndex = queueState.stale ? 0 : Number(state.currentIndex || 0);
  const currentIndex = clamp(rawIndex, 0, Math.max(queue.length - 1, 0));
  const current = queue[currentIndex] || queue[0];
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
    state: {
      playing: Boolean(state.playing),
      currentIndex,
      queueGeneration: queueGeneration(state),
      discoveryGeneration: Number(state.discoveryGeneration || 0),
      discoveryCount: Array.isArray(state.discoveryTracks) ? state.discoveryTracks.length : 0,
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
    INWORLD_TTS_LANGUAGE,
    INWORLD_TTS_GENDER,
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
      ttsProviderPreference: TTS_PROVIDER,
      inworldTts: {
        language: INWORLD_TTS_LANGUAGE,
        gender: INWORLD_TTS_GENDER,
        voiceId: INWORLD_TTS_VOICE_ID,
        model: INWORLD_TTS_MODEL
      },
      openWeather: {
        configured: openWeatherConfigured(),
        location: OPENWEATHER_LOCATION_LABEL || (openWeatherConfigured() ? `${OPENWEATHER_LAT},${OPENWEATHER_LON}` : ""),
        units: OPENWEATHER_UNITS,
        cacheSeconds: Math.round(OPENWEATHER_CACHE_MS / 1000)
      }
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/weather") {
    const force = url.searchParams.get("refresh") === "1";
    const current = force ? await refreshOpenWeatherCache(true) : cachedOpenWeather();
    sendJson(res, 200, {
      configured: openWeatherConfigured(),
      source: current ? "openweather" : "fallback",
      weather: current,
      lastError: openWeatherCache.lastError || null
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/world/catalog") {
    try {
      sendJson(res, 200, worldCatalogPayload());
    } catch (error) {
      console.warn("World catalog read failed", error.message);
      sendJson(res, 500, { error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/world/sync-preview") {
    try {
      const body = await parseBody(req);
      const source = body.source ? normalizeWorldSource(body.source) : null;
      const candidates = Array.isArray(body.candidates) ? body.candidates : [];
      const imported = upsertPendingWorldCandidates(candidates, source);
      sendJson(res, 200, worldCatalogPayload({
        preview: {
          mode: "local-review",
          imported: imported.length,
          message: imported.length
            ? "Candidates were added to the local review queue."
            : "No external fetch was performed. Configure a provider or submit candidates for review.",
          providers: providerStatus()
        }
      }));
    } catch (error) {
      console.warn("World sync preview failed", error.message);
      sendJson(res, 400, { error: error.message });
    }
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/world/approve") {
    try {
      const body = await parseBody(req);
      const action = body.action === "reject" ? "reject" : "approve";
      const result = reviewWorldCandidate(body.id, action, body.item || null);
      sendJson(res, 200, worldCatalogPayload({ review: result }));
    } catch (error) {
      console.warn("World approval failed", error.message);
      sendJson(res, 400, { error: error.message });
    }
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
    writeTasteMarkdown(nextProfile);
    const state = readJson("state.json");
    writeJson("state.json", {
      ...state,
      currentIndex: 0,
      queueGeneration: queueGeneration(state) + 1,
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

  if (req.method === "POST" && url.pathname === "/api/queue-track") {
    const body = await parseBody(req);
    const basePayload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const track = normalizeCustomTrack({
      ...(body.track || {}),
      requestedAt: new Date().toISOString()
    });

    if (!track) {
      sendJson(res, 400, { error: "Track is required" });
      return true;
    }

    const queueUpdate = applyChatQueueRequests(state, basePayload, [track]);
    if (queueUpdate.changed) writeJson("state.json", queueUpdate.state);

    let payload = stationPayload({ persistQueue: true });
    const targetIndex = payload.queue.findIndex((item) => item.id === track.id);
    if ((body.play === true || body.play === "true") && targetIndex >= 0) {
      const latest = readJson("state.json");
      writeJson("state.json", {
        ...latest,
        currentIndex: targetIndex,
        playing: true,
        queueDate: localDateKey(),
        queueSignature: payload.state.queueSignature,
        queueOrder: payload.state.queueOrder,
        updatedAt: new Date().toISOString()
      });
      payload = stationPayload({ persistQueue: true });
    }

    sendJson(res, 200, {
      ...payload,
      queuedTracks: [{
        id: track.id,
        title: track.title,
        artist: track.artist
      }]
    });
    return true;
  }

  if (req.method === "POST" && url.pathname === "/api/chat") {
    const body = await parseBody(req);
    const text = normalizeChatText(body.text);
    if (!text) {
      sendJson(res, 400, { error: "Message is required" });
      return true;
    }

    const basePayload = stationPayload({ persistQueue: true });
    const state = readJson("state.json");
    const history = compactChat(state.djChat);
    const userMessage = { role: "user", text, at: new Date().toISOString() };
    const catalog = readStationCatalog(state, basePayload.context);
    const requestedTracks = extractChatTrackRequests(text, catalog, basePayload.profile, basePayload.context);
    const queueUpdate = applyChatQueueRequests(state, basePayload, requestedTracks);
    if (queueUpdate.changed) writeJson("state.json", queueUpdate.state);

    const payload = queueUpdate.changed ? stationPayload({ persistQueue: true }) : basePayload;
    const replyText = appendQueueConfirmation(
      await generateDjChatReply(payload, text, history),
      queueUpdate.added
    );
    const assistantMessage = { role: "assistant", text: replyText, at: new Date().toISOString() };
    const nextMessages = compactChat([...history, userMessage, assistantMessage]);
    const latest = readJson("state.json");
    writeJson("state.json", {
      ...latest,
      djChat: nextMessages,
      updatedAt: new Date().toISOString()
    });
    const nextPayload = stationPayload({ persistQueue: true });
    sendJson(res, 200, {
      messages: nextMessages,
      reply: assistantMessage,
      payload: nextPayload,
      queuedTracks: queueUpdate.added.map((track) => ({
        id: track.id,
        title: track.title,
        artist: track.artist
      }))
    });
    return true;
  }

  if (req.method === "GET" && url.pathname === "/api/now") {
    sendJson(res, 200, stationPayload({ persistQueue: true }));
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
      weatherManual: body.weather != null && body.weather !== "",
      intensity: body.intensity ?? state.intensity,
      planText: typeof body.planText === "string" ? body.planText : state.planText,
      currentIndex: 0,
      queueGeneration: queueGeneration(state) + 1,
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
    const history = current ? [...(state.history || []), current.id].slice(-HISTORY_LIMIT) : state.history || [];
    const nextIndex = Number(payload.state.currentIndex || 0) + 1;
    const queueExhausted = nextIndex >= payload.queue.length;
    writeJson("state.json", {
      ...state,
      currentIndex: queueExhausted ? 0 : nextIndex,
      queueGeneration: queueExhausted ? queueGeneration(state) + 1 : queueGeneration(state),
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
      ? [...(state.history || []), current.id].slice(-HISTORY_LIMIT)
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
    const source = String(body.source || "toolbar").slice(0, 40);
    const broadcastRequest = requestedTrackId
      && body.silent !== true
      && body.silent !== "true"
      && !["pwa", "spotify", "spotify-status"].includes(source);
    const ids = new Set(Array.isArray(state.favoriteIds) ? state.favoriteIds : []);
    if (requestedTrackId && favorite) ids.add(requestedTrackId);
    if (requestedTrackId && !favorite) ids.delete(requestedTrackId);
    writeJson("state.json", {
      ...state,
      favoriteIds: [...ids],
      favoriteRequest: broadcastRequest ? {
        trackId: requestedTrackId,
        favorite,
        source,
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
      queueGeneration: queueGeneration(state) + 1,
      history: [],
      recommendationHistory: {},
      djChat: [],
      weatherManual: false,
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
    const noStore = [".html", ".js", ".css", ".webmanifest"].includes(ext);
    send(res, 200, content, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": noStore ? "no-store" : "public, max-age=300"
    });
  } catch (error) {
    sendJson(res, 500, { error: error.message });
  }
});

server.listen(PORT, () => {
  console.log(`RadioX Server listening on http://127.0.0.1:${PORT}`);
  console.log("connected to local taste / schedule / Spotify bridge");
  if (openWeatherConfigured()) {
    refreshOpenWeatherCache(true).then((weather) => {
      if (weather) console.log(`connected to OpenWeather / ${weather.location} / ${weather.tag}`);
    }).catch(() => {});
    setInterval(() => {
      refreshOpenWeatherCache(false).catch(() => {});
    }, Math.max(60_000, OPENWEATHER_CACHE_MS)).unref?.();
  }
});
