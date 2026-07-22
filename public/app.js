const els = {
  station: document.querySelector(".station"),
  time: document.querySelector("#time"),
  date: document.querySelector("#date"),
  heroLine: document.querySelector("#heroLine"),
  trackTitle: document.querySelector("#trackTitle"),
  trackArtist: document.querySelector("#trackArtist"),
  albumArt: document.querySelector("#albumArt"),
  playerAmbient: document.querySelector("#playerAmbient"),
  trackReason: document.querySelector("#trackReason"),
  playButton: document.querySelector("#playButton"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  favButton: document.querySelector("#favButton"),
  voiceButton: document.querySelector("#voiceButton"),
  spotifyButton: document.querySelector("#spotifyButton"),
  spotifySetup: document.querySelector("#spotifySetup"),
  spotifySetupClose: document.querySelector("#spotifySetupClose"),
  spotifyClientIdInput: document.querySelector("#spotifyClientIdInput"),
  spotifyRedirectUriInput: document.querySelector("#spotifyRedirectUriInput"),
  spotifySaveButton: document.querySelector("#spotifySaveButton"),
  spotifyLoginButton: document.querySelector("#spotifyLoginButton"),
  progress: document.querySelector("#progress"),
  elapsed: document.querySelector("#elapsed"),
  duration: document.querySelector("#duration"),
  volume: document.querySelector("#volume"),
  djChatLog: document.querySelector("#djChatLog"),
  djChatForm: document.querySelector("#djChatForm"),
  djChatInput: document.querySelector("#djChatInput"),
  contextReadout: document.querySelector("#contextReadout"),
  queue: document.querySelector("#queue"),
  queueCount: document.querySelector("#queueCount"),
  tasteTags: document.querySelector("#tasteTags"),
  tasteEditButton: document.querySelector("#tasteEditButton"),
  tasteSetup: document.querySelector("#tasteSetup"),
  tasteSetupClose: document.querySelector("#tasteSetupClose"),
  tasteStationInput: document.querySelector("#tasteStationInput"),
  tasteNicknameInput: document.querySelector("#tasteNicknameInput"),
  tasteAnchorsInput: document.querySelector("#tasteAnchorsInput"),
  tasteLeanInput: document.querySelector("#tasteLeanInput"),
  tasteNightGenresInput: document.querySelector("#tasteNightGenresInput"),
  tasteGenreWeightsInput: document.querySelector("#tasteGenreWeightsInput"),
  tasteSaveButton: document.querySelector("#tasteSaveButton"),
  tasteStatus: document.querySelector("#tasteStatus"),
  serverState: document.querySelector("#serverState"),
  systemStatus: document.querySelector("#systemStatus"),
  worldPanel: document.querySelector("#worldPanel"),
  worldGlobe: document.querySelector("#worldGlobe"),
  worldCountryFocus: document.querySelector("#worldCountryFocus"),
  worldCountryName: document.querySelector("#worldCountryName"),
  worldCountryMatches: document.querySelector("#worldCountryMatches"),
  worldCountryClear: document.querySelector("#worldCountryClear"),
  worldCanvas: document.querySelector("#worldCanvas"),
  world3dCanvas: document.querySelector("#world3dCanvas"),
  worldTourLayer: document.querySelector("#worldTourLayer"),
  worldTourTooltip: document.querySelector("#worldTourTooltip"),
  worldMarkers: document.querySelector("#worldMarkers"),
  worldAlbumOrbit: document.querySelector("#worldAlbumOrbit"),
  worldRankStrip: document.querySelector("#worldRankStrip"),
  bandDetail: document.querySelector("#bandDetail"),
  worldTabs: document.querySelector(".world-tabs"),
  worldEra: document.querySelector("#worldEra"),
  worldFullscreenButton: document.querySelector("#worldFullscreenButton"),
  spectrum: document.querySelector("#spectrum")
};

const app = {
  payload: null,
  playing: false,
  startedAt: 0,
  elapsedBeforePlay: 0,
  scrubbing: false,
  playbackMode: "idle",
  spotify: null,
  spotifyConfig: null,
  spotifyTrack: null,
  simAudio: null,
  voiceEnabled: localStorage.getItem("radiox.djVoice") !== "off",
  voiceRestore: null,
  voiceRunId: 0,
  djAudio: null,
  djAudioUrl: "",
  advancing: false,
  spotifyPlaySeq: 0,
  expectedSpotifyUri: "",
  spotifyMismatchTimer: null,
  spotifyPrefetchTimer: null,
  spotifyAutoAdvanceUri: "",
  albumArtLookupKey: "",
  albumArtLookupSeq: 0,
  albumPaletteKey: "",
  lastRenderedTrackId: "",
  queueDragTrackId: "",
  queuePointerDrag: null,
  worldBandId: "",
  worldHoverBandId: "",
  worldAlbumKey: "",
  worldFilter: "million",
  worldEra: "all",
  worldCountryName: "",
  worldCountryLocked: false,
  worldCenterLon: 20,
  worldCenterLat: 12,
  worldZoom: 1,
  worldAutoRotate: true,
  worldHoverPausedRotation: false,
  worldVelocityLon: 0.018,
  worldVelocityLat: 0,
  worldDragging: false,
  worldDragStart: null,
  worldFocusAnimation: null,
  world3D: null,
  worldLastFrameAt: 0,
  worldLastDrawAt: 0,
  worldFullscreen: false,
  worldCountries: [],
  worldAtlasLoading: false,
  worldAtlasSource: "fallback",
  worldAlbumCovers: new Map(),
  worldAlbumLookup: new Set(),
  worldTasteFieldCache: null,
  worldQueueingKey: "",
  worldCatalog: null,
  worldCatalogLoadedAt: 0,
  serviceConfig: null,
  systemIssues: {},
  audioFeaturesCache: new Map(),
  favoriteStatusCache: new Map(),
  favoriteSyncing: new Set(),
  spotifyLibrarySyncDisabled: false,
  currentAudioFeatures: null,
  lastFavoriteRequestKey: localStorage.getItem("radiox.favoriteRequestKey") || "",
  spotifyState: {
    uri: "",
    positionSeconds: 0,
    durationSeconds: 0,
    updatedAt: 0,
    paused: true
  },
  favorites: new Set(JSON.parse(localStorage.getItem("radiox.favorites") || "[]"))
};

const SPOTIFY_CLIENT_ID_KEY = "radiox.spotify.clientId";
const SPOTIFY_TOKEN_KEY = "radiox.spotify.token";
const DJ_VOICE_KEY = "radiox.djVoice";
const FAVORITE_REQUEST_KEY = "radiox.favoriteRequestKey";
const APP_TITLE = "RadioX";

function canonicalLoopbackOrigin() {
  return `${window.location.protocol}//127.0.0.1:${window.location.port || "8765"}`;
}

function canonicalizeLoopbackOrigin() {
  if (window.location.hostname !== "localhost") return false;
  const next = new URL(window.location.href);
  next.hostname = "127.0.0.1";
  const clientId = localStorage.getItem(SPOTIFY_CLIENT_ID_KEY);
  if (clientId) next.searchParams.set("spotify_client_id", clientId);
  window.location.replace(next.toString());
  return true;
}

function consumeTransferredSpotifyClientId() {
  const url = new URL(window.location.href);
  const clientId = url.searchParams.get("spotify_client_id");
  if (!clientId) return;
  localStorage.setItem(SPOTIFY_CLIENT_ID_KEY, clientId);
  url.searchParams.delete("spotify_client_id");
  window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
}

function formatTime(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const min = Math.floor(safe / 60);
  const sec = String(safe % 60).padStart(2, "0");
  return `${min}:${sec}`;
}

function stableVoiceHash(value) {
  let hash = 2166136261;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function clampValue(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeDegrees(value) {
  let next = Number(value || 0);
  while (next > 180) next -= 360;
  while (next < -180) next += 360;
  return next;
}

function api(path, options = {}) {
  return fetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  }).then((response) => {
    if (!response.ok) throw new Error(`${path} ${response.status}`);
    return response.json();
  });
}

function saveFavorites() {
  localStorage.setItem("radiox.favorites", JSON.stringify([...app.favorites]));
}

function setLocalFavorite(trackId, favorite) {
  if (!trackId) return;
  if (favorite) app.favorites.add(trackId);
  else app.favorites.delete(trackId);
  saveFavorites();
  updateCurrentFavoriteButton();
}

function syncFavoritesFromServer(payload) {
  const serverIds = payload?.state?.favoriteIds;
  if (!Array.isArray(serverIds)) return;
  app.favorites = new Set(serverIds);
  saveFavorites();
}

function favoriteRequestKey(request) {
  if (!request?.trackId || !request?.requestedAt) return "";
  return `${request.requestedAt}:${request.trackId}:${request.favorite !== false}`;
}

function findTrackById(payload, trackId) {
  if (!trackId || !payload) return null;
  if (payload.current?.id === trackId) return payload.current;
  return (payload.queue || []).find((track) => track.id === trackId) || null;
}

function updateCurrentFavoriteButton() {
  const id = app.payload?.current?.id;
  if (!id || !els.favButton) return;
  els.favButton.textContent = app.favorites.has(id) ? "♥" : "♡";
}

function handleRemoteFavoriteRequest(payload) {
  const request = payload?.state?.favoriteRequest;
  const key = favoriteRequestKey(request);
  if (!key || key === app.lastFavoriteRequestKey) return;
  app.lastFavoriteRequestKey = key;
  localStorage.setItem(FAVORITE_REQUEST_KEY, key);

  const track = findTrackById(payload, request.trackId);
  const favorite = request.favorite !== false;
  setLocalFavorite(request.trackId, favorite);
  if (track) syncFavoriteToSpotify(track, favorite).catch(console.warn);
}

function speechSupported() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function cloudTtsConfigured() {
  return Boolean(app.spotifyConfig?.ttsConfigured ?? app.spotifyConfig?.openAiTtsConfigured);
}

function isSpotifyLibraryPermissionError(error) {
  return /library|permission|scope|403/i.test(error?.message || "");
}

function isSpotifyTokenError(error) {
  return /token|expired|not authenticated|401/i.test(error?.message || "");
}

function djVoiceSupported() {
  return Boolean(cloudTtsConfigured() || speechSupported());
}

function updateVoiceButton() {
  if (!els.voiceButton) return;
  const supported = djVoiceSupported();
  els.voiceButton.disabled = !supported;
  els.voiceButton.textContent = supported
    ? (app.voiceEnabled ? "VOICE ON" : "VOICE OFF")
    : "NO VOICE";
  els.voiceButton.classList.toggle("connected", supported && app.voiceEnabled);
}

function setVoiceEnabled(enabled) {
  app.voiceEnabled = Boolean(enabled);
  localStorage.setItem(DJ_VOICE_KEY, app.voiceEnabled ? "on" : "off");
  updateVoiceButton();
}

function preferredDjVoice() {
  if (!speechSupported()) return null;
  const voices = window.speechSynthesis.getVoices();
  const preferred = [
    /Ting-Ting/i,
    /Mei-Jia/i,
    /Sin-ji/i,
    /Li-mu/i,
    /^zh-CN/i,
    /^zh-Hans/i,
    /^zh/i,
    /^ja/i,
    /^en/i
  ];
  return preferred
    .map((pattern) => voices.find((voice) => pattern.test(`${voice.name || ""} ${voice.lang || ""}`)))
    .find(Boolean) || voices[0] || null;
}

function naturalizeDjText(text) {
  return String(text || "")
    .replace(/RadioX/g, "Radio X")
    .replace(/&/g, "和")
    .replace(/(\d+)%/g, "百分之$1")
    .replace(/\s*\/\s*/g, "，")
    .replace(/\s+/g, " ")
    .replace(/。+/g, "。")
    .replace(/，+/g, "，")
    .trim();
}

function normalizeMatchText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/g, " ")
    .trim();
}

function spotifyTrackMatchesCurrent(spotifyTrack, current) {
  if (!spotifyTrack || !current) return false;
  const title = normalizeMatchText(current.title);
  const spotifyTitle = normalizeMatchText(spotifyTrack.name);
  const artist = normalizeMatchText(String(current.artist || "").split(/\s+(?:&|and|和)\s+|,/i)[0]);
  const spotifyArtists = normalizeMatchText((spotifyTrack.artists || []).map((item) => item.name).join(" "));
  const artistIsPlaceholder = /^(spotify request|radiox request|listener request|unknown)$/i.test(String(current.artist || "").trim());
  const artistMatches = artistIsPlaceholder || !artist || spotifyArtists.includes(artist);
  return Boolean(title && (spotifyTitle.includes(title) || title.includes(spotifyTitle)) && artistMatches);
}

function spotifyAlbumCoverUrl(spotifyTrack) {
  const images = Array.isArray(spotifyTrack?.album?.images) ? spotifyTrack.album.images : [];
  return [...images]
    .filter((image) => image?.url)
    .sort((a, b) => Number(b.width || 0) - Number(a.width || 0))[0]?.url || "";
}

function fallbackAlbumInitials(track) {
  const title = String(track?.title || "").trim();
  if (!title) return "RX";
  const parts = title.split(/\s+/).filter(Boolean);
  if (parts.length >= 2 && /^[\x00-\x7F]+$/.test(title)) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase() || "RX";
  }
  return [...title].slice(0, 2).join("").toUpperCase() || "RX";
}

function albumArtKey(track) {
  if (!track) return "";
  return String(track.id || `${track.title || ""}|${track.artist || ""}`);
}

function fallbackTrackPalette(track) {
  const seed = parseInt(stableVoiceHash(`${track?.id || "radiox"}:${track?.artist || ""}`), 36) || 142;
  const hues = [158, 184, 338, 42, 208, 12];
  const hue = hues[seed % hues.length];
  const secondHue = (hue + 42 + seed % 76) % 360;
  return {
    primary: `hsl(${hue} 78% 58%)`,
    secondary: `hsl(${secondHue} 72% 64%)`,
    rgb: hue === 158 ? "57,245,176" : hue === 42 ? "247,201,92" : "151,231,255"
  };
}

function applyTrackPalette(track, palette, coverUrl = "") {
  if (!els.station) return;
  const colors = palette || fallbackTrackPalette(track);
  els.station.style.setProperty("--track-accent", colors.primary);
  els.station.style.setProperty("--track-secondary", colors.secondary);
  els.station.style.setProperty("--track-rgb", colors.rgb);
  if (els.playerAmbient) {
    els.playerAmbient.style.backgroundImage = coverUrl ? `url("${coverUrl.replace(/["\\]/g, "")}")` : "";
    els.playerAmbient.classList.toggle("has-cover", Boolean(coverUrl));
  }
}

function imagePalette(image, track) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 32;
    canvas.height = 32;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    context.drawImage(image, 0, 0, 32, 32);
    const pixels = context.getImageData(0, 0, 32, 32).data;
    const buckets = new Map();
    for (let index = 0; index < pixels.length; index += 16) {
      const alpha = pixels[index + 3];
      if (alpha < 180) continue;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      if (max < 45 || min > 225 || max - min < 24) continue;
      const key = `${Math.round(r / 32) * 32},${Math.round(g / 32) * 32},${Math.round(b / 32) * 32}`;
      buckets.set(key, (buckets.get(key) || 0) + 1 + (max - min) / 80);
    }
    const ranked = [...buckets]
      .map(([key, score]) => ({ rgb: key.split(",").map(Number), score }))
      .sort((a, b) => b.score - a.score);
    if (!ranked.length) return fallbackTrackPalette(track);
    const primary = ranked[0].rgb;
    const secondary = ranked.find((entry) => Math.hypot(
      entry.rgb[0] - primary[0],
      entry.rgb[1] - primary[1],
      entry.rgb[2] - primary[2]
    ) > 95)?.rgb || fallbackTrackPalette(track).secondary;
    return {
      primary: `rgb(${primary.join(",")})`,
      secondary: Array.isArray(secondary) ? `rgb(${secondary.join(",")})` : secondary,
      rgb: primary.join(",")
    };
  } catch (error) {
    return fallbackTrackPalette(track);
  }
}

function renderAlbumArt(track, spotifyTrack = app.spotifyTrack) {
  if (!els.albumArt) return;
  const coverUrl = spotifyTrackMatchesCurrent(spotifyTrack, track) ? spotifyAlbumCoverUrl(spotifyTrack) : "";
  els.albumArt.classList.toggle("has-cover", Boolean(coverUrl));
  const paletteKey = `${albumArtKey(track)}:${coverUrl}`;
  if (app.albumPaletteKey !== paletteKey) {
    app.albumPaletteKey = paletteKey;
    applyTrackPalette(track, fallbackTrackPalette(track), coverUrl);
  }

  if (coverUrl) {
    const existing = els.albumArt.querySelector("img");
    if (existing?.src === coverUrl) {
      existing.alt = `${track?.title || "Current track"} album cover`;
      return;
    }
    const image = document.createElement("img");
    image.crossOrigin = "anonymous";
    image.src = coverUrl;
    image.alt = `${track?.title || "Current track"} album cover`;
    image.decoding = "async";
    image.loading = "lazy";
    image.addEventListener("load", () => {
      if (app.albumPaletteKey === paletteKey) applyTrackPalette(track, imagePalette(image, track), coverUrl);
    }, { once: true });
    els.albumArt.replaceChildren(image);
    return;
  }

  const fallback = document.createElement("span");
  fallback.textContent = fallbackAlbumInitials(track);
  els.albumArt.replaceChildren(fallback);
}

function loadAlbumArtForTrack(track) {
  renderAlbumArt(track);
  if (!track || !app.spotify?.status().authenticated || typeof app.spotify.resolveTrack !== "function") return;
  if (spotifyTrackMatchesCurrent(app.spotifyTrack, track) && spotifyAlbumCoverUrl(app.spotifyTrack)) return;

  const key = albumArtKey(track);
  if (!key || app.albumArtLookupKey === key) return;
  const lookupSeq = ++app.albumArtLookupSeq;
  app.albumArtLookupKey = key;
  app.spotify.resolveTrack(track)
    .then((spotifyTrack) => {
      if (!spotifyTrack || lookupSeq !== app.albumArtLookupSeq || albumArtKey(app.payload?.current) !== key) return;
      app.spotifyTrack = spotifyTrack;
      renderAlbumArt(track, spotifyTrack);
    })
    .catch((error) => {
      if (app.albumArtLookupKey === key) app.albumArtLookupKey = "";
      console.warn("Album art lookup skipped", error);
    });
}

function resetSpotifyPlaybackTracking() {
  app.spotifyState = {
    uri: "",
    positionSeconds: 0,
    durationSeconds: 0,
    updatedAt: 0,
    paused: true
  };
}

function splitVoiceParts(text) {
  return naturalizeDjText(text)
    .split(/(?<=[。！？!?])\s*/)
    .map((part) => part.trim())
    .filter(Boolean)
    .flatMap((part) => {
      if (part.length <= 58) return [part];
      return part
        .split(/(?<=，)\s*/)
        .map((item) => item.trim())
        .filter(Boolean);
    })
    .slice(0, 5);
}

function restoreVoiceDucking() {
  const restore = app.voiceRestore;
  app.voiceRestore = null;
  restore?.();
}

function setDjSpeaking(active) {
  els.djChatLog?.classList.toggle("speaking", Boolean(active));
}

function stopDjVoice() {
  app.voiceRunId += 1;
  app.djAudio?.pause();
  app.djAudio = null;
  if (app.djAudioUrl) {
    URL.revokeObjectURL(app.djAudioUrl);
    app.djAudioUrl = "";
  }
  if (speechSupported()) window.speechSynthesis.cancel();
  restoreVoiceDucking();
  setDjSpeaking(false);
  if (["TALKING", "VOICE", "OPENAI VOICE", "INWORLD VOICE", "DJ VOICE", "BROWSER VOICE"].includes(els.serverState?.textContent)) setServerState("READY");
}

function duckPlaybackForVoice() {
  const originalVolume = Number(els.volume.value) || 76;
  const duckedVolume = Math.max(10, Math.round(originalVolume * 0.32));
  if (app.playing) {
    app.simAudio?.setVolume(duckedVolume);
    app.spotify?.setVolume(duckedVolume / 100).catch(console.warn);
  }
  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    app.simAudio?.setVolume(originalVolume);
    app.spotify?.setVolume(originalVolume / 100).catch(console.warn);
  };
}

function cloudVoiceLabel(headerValue) {
  const provider = String(headerValue || app.spotifyConfig?.ttsProvider || "").toLowerCase();
  if (provider.includes("inworld")) return "INWORLD VOICE";
  if (provider.includes("openai")) return "OPENAI VOICE";
  return "DJ VOICE";
}

async function playCloudTextVoice(text, key, runId) {
  if (!cloudTtsConfigured()) return false;
  const spokenText = naturalizeDjText(text);
  if (!spokenText) return false;

  try {
    setServerState("VOICE");
    const response = await fetch("/api/dj-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key,
        text: spokenText
      })
    });
    if (!response.ok) throw new Error(`/api/dj-audio ${response.status}`);
    const voiceLabel = cloudVoiceLabel(response.headers.get("X-RadioX-Voice"));
    const blob = await response.blob();
    if (runId !== app.voiceRunId) return true;

    setSystemIssue("TTS", "");
    app.djAudioUrl = URL.createObjectURL(blob);
    app.djAudio = new Audio(app.djAudioUrl);
    app.voiceRestore = duckPlaybackForVoice();
    app.djAudio.onplay = () => {
      setDjSpeaking(true);
      setServerState(voiceLabel);
    };
    app.djAudio.onended = () => {
      setDjSpeaking(false);
      restoreVoiceDucking();
      if (app.djAudioUrl) URL.revokeObjectURL(app.djAudioUrl);
      app.djAudioUrl = "";
      app.djAudio = null;
      if (els.serverState?.textContent === voiceLabel) setServerState("READY");
    };
    app.djAudio.onerror = () => {
      setDjSpeaking(false);
      restoreVoiceDucking();
      if (app.djAudioUrl) URL.revokeObjectURL(app.djAudioUrl);
      app.djAudioUrl = "";
      app.djAudio = null;
      setServerState("READY");
    };
    await app.djAudio.play();
    return true;
  } catch (error) {
    console.warn("Cloud TTS voice fallback", error);
    setSystemIssue("TTS", error.message || "cloud voice fallback");
    setServerState("BROWSER VOICE");
    return false;
  }
}

function speakBrowserText(parts, runId) {
  if (!speechSupported()) return;
  const voice = preferredDjVoice();
  app.voiceRestore = duckPlaybackForVoice();
  const finish = () => {
    setDjSpeaking(false);
    restoreVoiceDucking();
    if (["TALKING", "BROWSER VOICE"].includes(els.serverState?.textContent)) setServerState("READY");
  };

  const speakPart = (index) => {
    if (runId !== app.voiceRunId || index >= parts.length) {
      finish();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(parts[index]);
    utterance.lang = voice?.lang || "zh-CN";
    utterance.voice = voice;
    utterance.rate = index === 0 ? 0.86 : 0.9;
    utterance.pitch = index === 0 ? 0.82 : 0.86;
    utterance.volume = 1;
    utterance.onstart = () => {
      setDjSpeaking(true);
      setServerState("BROWSER VOICE");
    };
    utterance.onerror = finish;
    utterance.onend = () => {
      const pause = index === 0 ? 420 : 260;
      window.setTimeout(() => speakPart(index + 1), pause);
    };
    window.speechSynthesis.speak(utterance);
  };

  speakPart(0);
}

async function speakDjChatReply(message) {
  const text = naturalizeDjText(message?.text || "");
  if (!app.voiceEnabled || !djVoiceSupported() || !text) return;

  const key = `chat:${message?.at || Date.now()}:${stableVoiceHash(text)}`;
  stopDjVoice();
  const runId = app.voiceRunId;
  const ttsStarted = await playCloudTextVoice(text, key, runId);
  if (!ttsStarted && runId === app.voiceRunId) speakBrowserText(splitVoiceParts(text), runId);
}

async function syncFavoriteToSpotify(track, favorite = true) {
  if (app.spotifyLibrarySyncDisabled) return false;
  if (!track || !app.spotify?.configured()) return false;
  if (!app.spotify.status().authenticated) {
    els.spotifyButton.textContent = "LOGIN";
    setServerState("LOGIN");
    return false;
  }

  const syncKey = `write:${track.id}:${favorite}`;
  if (app.favoriteSyncing.has(syncKey)) return false;
  app.favoriteSyncing.add(syncKey);
  const previousFavText = els.favButton.textContent;
  const previousSpotifyText = els.spotifyButton.textContent;
  els.favButton.textContent = "…";
  els.spotifyButton.textContent = favorite ? "SAVING" : "REMOVING";
  try {
    const spotifyTrack = favorite
      ? await app.spotify.saveTrackToLibrary(track)
      : await app.spotify.removeTrackFromLibrary(track);
    app.spotifyTrack = spotifyTrack;
    renderAlbumArt(track, spotifyTrack);
    app.favoriteStatusCache.set(track.id, {
      saved: favorite,
      checkedAt: Date.now()
    });
    setLocalFavorite(track.id, favorite);
    els.spotifyButton.textContent = favorite ? "SAVED" : "REMOVED";
    setServerState(favorite ? "SAVED" : "REMOVED");
    window.setTimeout(() => {
      if (["SAVED", "REMOVED"].includes(els.spotifyButton.textContent)) updateSpotifyButton();
      setServerState("READY");
    }, 1200);
    return true;
  } catch (error) {
    console.warn(error);
    els.favButton.textContent = previousFavText;
    if (isSpotifyLibraryPermissionError(error)) {
      app.spotifyLibrarySyncDisabled = true;
      els.spotifyButton.textContent = previousSpotifyText;
      updateSpotifyButton();
      setServerState("FAV OFF");
    } else if (isSpotifyTokenError(error)) {
      app.spotify.clearToken();
      app.spotify.resetPlayer();
      els.spotifyButton.textContent = "LOGIN";
      setServerState("LOGIN");
    } else {
      els.spotifyButton.textContent = "SAVE ERR";
      setServerState("RETRY");
      window.setTimeout(() => {
        if (els.spotifyButton.textContent === "SAVE ERR") {
          els.spotifyButton.textContent = previousSpotifyText;
          updateSpotifyButton();
        }
      }, 1600);
    }
    return false;
  } finally {
    app.favoriteSyncing.delete(syncKey);
  }
}

async function syncFavoriteStatusFromSpotify(track, options = {}) {
  if (app.spotifyLibrarySyncDisabled) return false;
  if (!track || !app.spotify?.status().authenticated || !app.spotify.isTrackSaved) return false;
  const trackId = track.id;
  const cached = app.favoriteStatusCache.get(trackId);
  if (!options.force && cached && Date.now() - cached.checkedAt < 15000) return cached.saved;

  const syncKey = `read:${trackId}`;
  if (app.favoriteSyncing.has(syncKey)) return false;
  app.favoriteSyncing.add(syncKey);
  try {
    const saved = await app.spotify.isTrackSaved(track);
    app.favoriteStatusCache.set(trackId, {
      saved,
      checkedAt: Date.now()
    });
    if (app.payload?.current?.id !== trackId) return saved;
    if (app.favorites.has(trackId) !== saved) {
      setLocalFavorite(trackId, saved);
      const payload = await api("/api/favorite", {
        method: "POST",
        body: JSON.stringify({
          trackId,
          favorite: saved,
          source: "spotify-status",
          silent: true
        })
      });
      if (payload?.state) {
        app.payload = payload;
        syncFavoritesFromServer(payload);
        updateCurrentFavoriteButton();
      }
    }
    return saved;
  } catch (error) {
    console.warn(error);
    if (isSpotifyLibraryPermissionError(error)) {
      app.spotifyLibrarySyncDisabled = true;
      updateSpotifyButton();
      setServerState("FAV OFF");
    } else if (isSpotifyTokenError(error)) {
      app.spotify?.clearToken();
      app.spotify?.resetPlayer();
      updateSpotifyButton();
      setServerState("LOGIN");
    }
    return false;
  } finally {
    app.favoriteSyncing.delete(syncKey);
  }
}

function heroFromContext(context) {
  const day = context.now.weekday;
  const mood = {
    breath: "Exhale",
    focus: "Deep Focus",
    blue: "Blue Hour",
    recover: "Soft Landing",
    drive: "Forward Motion",
    fire: "Voltage"
  }[context.mood] || "Signal";
  const part = {
    morning: "Morning",
    workday: "Workday",
    dusk: "Dusk",
    night: "Night",
    "deep-night": "Late Night"
  }[context.now.dayPart] || "Today";
  return `${day} ${part} ${mood}`;
}

function weatherReadout(context) {
  const detail = context?.weatherDetail;
  if (!detail) return context?.weather || "open";
  const tempUnit = detail.units === "imperial" ? "°F" : detail.units === "standard" ? "K" : "°C";
  const temp = Number.isFinite(Number(detail.temp)) ? ` · ${Math.round(Number(detail.temp))}${tempUnit}` : "";
  const source = context.weatherSource === "openweather" ? "OpenWeather" : context.weatherSource || "";
  return [context.weather, detail.description, source].filter(Boolean).join(" · ") + temp;
}

function queueMatchPercent(track) {
  const score = Number(track?.score || 0);
  return Math.round(clampValue(58 + score / 8, 58, 99));
}

function renderQueue(queue, current = null) {
  if (!els.queue || !els.queueCount) return;
  els.queueCount.textContent = `${queue.length} TRACKS`;
  els.queue.innerHTML = queue.map((track, index) => {
    const active = track.id === current?.id;
    const reason = track.reason || track.story?.headline || "RadioX crate note";
    return `
      <li class="${active ? "active" : ""}" draggable="true" data-queue-index="${index}" data-queue-track-id="${escapeAttr(track.id)}" aria-label="${escapeAttr(`${track.title} by ${track.artist}`)}">
        <span class="queue-grip" aria-hidden="true">⋮⋮</span>
        <div class="queue-copy">
          <b>${escapeHtml(track.title)}</b>
          <span>${escapeHtml(track.artist)}</span>
          <small>${escapeHtml(reason)}</small>
          <div class="queue-path"><i style="--match:${queueMatchPercent(track)}%"></i><em>${queueMatchPercent(track)}% MATCH</em></div>
        </div>
        <strong class="queue-index">${active ? "ON" : String(index + 1).padStart(2, "0")}</strong>
      </li>
    `;
  }).join("");
}

function render(payload) {
  const safePayload = payload || {};
  const current = safePayload.current || null;
  const context = {
    weather: "open",
    mood: "focus",
    intensity: 0,
    scheduleTags: [],
    now: {},
    ...(safePayload.context || {})
  };
  context.now = { weekday: "Today", dayPart: "today", ...(context.now || {}) };
  context.scheduleTags = Array.isArray(context.scheduleTags) ? context.scheduleTags : [];
  const profile = safePayload.profile || {};
  const queue = Array.isArray(safePayload.queue) ? safePayload.queue : [];
  const state = { volume: Number(els.volume?.value || 70), djChat: [], ...(safePayload.state || {}) };
  app.payload = { ...safePayload, current, context, profile, queue, state };
  if (current?.id && current.id !== app.lastRenderedTrackId) {
    app.lastRenderedTrackId = current.id;
    els.station?.classList.remove("track-changing");
    window.requestAnimationFrame(() => els.station?.classList.add("track-changing"));
    window.setTimeout(() => els.station?.classList.remove("track-changing"), 720);
  }
  syncFavoritesFromServer(app.payload);
  els.heroLine.textContent = heroFromContext(context);
  const hasCurrent = Boolean(current);
  els.playButton.disabled = !hasCurrent;
  els.prevButton.disabled = !hasCurrent;
  els.nextButton.disabled = !hasCurrent;
  els.favButton.disabled = !hasCurrent;
  els.progress.disabled = !hasCurrent;
  if (!hasCurrent) {
    els.trackTitle.textContent = "正在整理下一批歌";
    els.trackArtist.textContent = "RadioX 会继续向后推进，优先避开最近听过的曲目";
    app.albumArtLookupKey = "";
    renderAlbumArt(null);
    els.duration.textContent = "0:00";
    els.elapsed.textContent = "0:00";
    els.progress.value = "0";
    els.playButton.textContent = "▶";
    els.favButton.textContent = "♡";
    updateVoiceButton();
    renderDjChat(state.djChat || []);
    els.contextReadout.innerHTML = `
      <div>weather: <strong>${escapeHtml(weatherReadout(context))}</strong></div>
      <div>mood: <strong>${context.mood}</strong> / intensity <strong>${context.intensity}</strong></div>
      <div>schedule: <strong>${context.scheduleTags.join(", ")}</strong></div>
    `;
    if (els.trackReason) els.trackReason.textContent = "";
    renderQueue(queue, null);
    renderTasteTags(profile);
    scheduleSpotifyPrefetch();
    handleRemoteFavoriteRequest(app.payload);
    renderSystemStatus();
    return;
  }
  els.trackTitle.textContent = current.title;
  const currentGenres = Array.isArray(current.genres) ? current.genres : [];
  els.trackArtist.textContent = `${current.artist} — ${currentGenres.join(" / ") || "RadioX"}`;
  if (els.trackReason) els.trackReason.textContent = current.reason || current.story?.headline || "";
  loadAlbumArtForTrack(current);
  els.duration.textContent = formatTime(current.duration);
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
  els.volume.value = state.volume;
  updateCurrentFavoriteButton();
  updateVoiceButton();
  renderDjChat(state.djChat || []);

  els.contextReadout.innerHTML = `
    <div>weather: <strong>${escapeHtml(weatherReadout(context))}</strong></div>
    <div>mood: <strong>${context.mood}</strong> / intensity <strong>${context.intensity}</strong></div>
    <div>schedule: <strong>${context.scheduleTags.join(", ")}</strong></div>
  `;

  renderQueue(queue, current);

  renderTasteTags(profile);
  scheduleSpotifyPrefetch();
  handleRemoteFavoriteRequest(app.payload);
  renderSystemStatus();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  }[char]));
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/`/g, "&#96;");
}

function setSystemIssue(scope, message) {
  if (!scope) return;
  if (message) app.systemIssues[scope] = String(message);
  else delete app.systemIssues[scope];
  renderSystemStatus();
}

function serviceTone(value) {
  if (/connected|ready|openweather|ok|future|loaded|inworld|openai|cloud|album mode/i.test(value)) return "ok";
  if (/login|fallback|manual|pending|browser|loading|waiting|setup/i.test(value)) return "warn";
  return "bad";
}

function statusBadge(label, value, tone = serviceTone(value)) {
  return `
    <span class="system-badge ${escapeAttr(tone)}">
      <i></i>
      <b>${escapeHtml(label)}</b>
      <em>${escapeHtml(value)}</em>
    </span>
  `;
}

function spotifyStatusLabel() {
  if (!app.spotifyConfig?.spotifyClientId) return "setup";
  const status = app.spotify?.status?.();
  if (status?.connected) return "connected";
  if (status?.authenticated) return "ready";
  return "login";
}

function weatherStatusLabel() {
  const source = app.payload?.context?.weatherSource || "";
  if (source === "openweather") return "OpenWeather";
  if (app.spotifyConfig?.openWeather?.configured) return source || "waiting";
  return "fallback";
}

function worldStatusLabel() {
  const stats = app.worldCatalog?.stats;
  if (!stats) return "loading";
  if (Number(stats.futureTourStops || 0) > 0) return `${stats.futureTourStops} future stops`;
  return "album mode";
}

function mobileStatusLabel() {
  if (app.spotifyConfig?.secureContext) return "HTTPS";
  if (app.spotifyConfig?.httpsAvailable) return "LAN HTTP";
  return "setup";
}

function renderSystemStatus() {
  if (!els.systemStatus) return;
  const provider = app.spotifyConfig?.ttsConfigured
    ? (app.spotifyConfig.ttsProvider || "cloud")
    : "browser";
  const pending = Number(app.worldCatalog?.stats?.pending || 0);
  const issueEntries = Object.entries(app.systemIssues || {}).filter(([, value]) => value);
  els.systemStatus.innerHTML = `
    <div class="system-badges">
      ${statusBadge("Spotify", spotifyStatusLabel())}
      ${statusBadge("TTS", provider)}
      ${statusBadge("Weather", weatherStatusLabel())}
      ${statusBadge("World", worldStatusLabel())}
      ${statusBadge("Mobile", mobileStatusLabel())}
      ${pending ? statusBadge("Review", `${pending} pending`, "warn") : ""}
    </div>
    ${issueEntries.length ? `
      <div class="system-issues">
        ${issueEntries.slice(0, 4).map(([scope, message]) => `
          <p><b>${escapeHtml(scope)}</b><span>${escapeHtml(message)}</span></p>
        `).join("")}
      </div>
    ` : ""}
  `;
}

function albumFromReviewItem(item) {
  if (!item?.album?.title) return null;
  return {
    title: item.album.title,
    year: item.album.year || "",
    million: item.album.category === "million" || Boolean(item.album.salesM),
    grammy: item.album.grammyYear ? { year: item.album.grammyYear, award: "Grammy" } : null,
    lead: item.album.lead || item.album.title,
    tracks: item.album.tracks || [item.album.title],
    image: item.album.image || ""
  };
}

function mergeWorldReviewCatalog(catalog) {
  const approved = Array.isArray(catalog?.approved?.reviewItems) ? catalog.approved.reviewItems : [];
  if (!approved.length) return;
  window.RADIOX_WORLD_BANDS = Array.isArray(window.RADIOX_WORLD_BANDS) ? window.RADIOX_WORLD_BANDS : [];
  window.RADIOX_WORLD_TOURS = window.RADIOX_WORLD_TOURS && typeof window.RADIOX_WORLD_TOURS === "object"
    ? window.RADIOX_WORLD_TOURS
    : {};
  approved.forEach((item) => {
    const artist = item.artist || item.band || {};
    const id = artist.id || item.id;
    if (!id || !artist.name) return;
    let band = window.RADIOX_WORLD_BANDS.find((entry) => entry.id === id);
    if (!band) {
      band = {
        id,
        name: artist.name,
        country: artist.country || "Reviewed",
        city: artist.city || "",
        lat: artist.lat,
        lon: artist.lon,
        genres: ["reviewed"],
        claimedSalesM: item.album?.salesM || null,
        taste: true,
        albums: []
      };
      window.RADIOX_WORLD_BANDS.push(band);
    }
    const album = albumFromReviewItem(item);
    if (album && !band.albums.some((entry) => entry.title === album.title)) band.albums.push(album);
    if (item.tour?.dates?.length) {
      window.RADIOX_WORLD_TOURS[id] = {
        name: item.tour.name || `${artist.name} upcoming tour`,
        sourceLabel: item.source?.label || item.tour.source?.label || "Reviewed source",
        sourceUrl: item.source?.url || item.tour.source?.url || "",
        stops: item.tour.dates
      };
    }
  });
}

async function loadWorldCatalogFromApi() {
  try {
    const catalog = await api("/api/world/catalog");
    app.worldCatalog = catalog;
    app.worldCatalogLoadedAt = Date.now();
    mergeWorldReviewCatalog(catalog);
    setSystemIssue("World", "");
    return catalog;
  } catch (error) {
    console.warn("World catalog API failed", error);
    setSystemIssue("World", error.message || "catalog unavailable");
    return null;
  }
}

async function refreshWeatherStatus() {
  try {
    const status = await api("/api/weather");
    setSystemIssue("Weather", status.lastError || "");
    renderSystemStatus();
    return status;
  } catch (error) {
    console.warn("Weather status failed", error);
    setSystemIssue("Weather", error.message || "weather unavailable");
    return null;
  }
}

const WORLD_GLOBE_RADIUS_RATIO = 0.47;
const WORLD_GLOBE_MARKER_RADIUS = WORLD_GLOBE_RADIUS_RATIO * 100;
const WORLD_COUNTRY_PALETTE = [
  [42, 58, 45],
  [97, 42, 42],
  [150, 45, 38],
  [185, 46, 40],
  [213, 48, 44],
  [258, 34, 48],
  [304, 36, 45],
  [12, 50, 47],
  [330, 38, 47],
  [72, 50, 42],
  [26, 46, 43],
  [168, 43, 38]
];

const WORLD_LANDMASSES = [
  {
    name: "North America",
    kind: "continent",
    points: [[-168, 71], [-152, 72], [-140, 69], [-132, 61], [-125, 55], [-124, 49], [-118, 34], [-111, 27], [-103, 22], [-95, 18], [-86, 20], [-81, 25], [-80, 31], [-75, 36], [-69, 43], [-62, 48], [-54, 55], [-58, 63], [-72, 68], [-91, 72], [-116, 74], [-142, 73]]
  },
  {
    name: "Canadian Arctic",
    kind: "ice",
    points: [[-132, 76], [-110, 78], [-88, 76], [-78, 72], [-93, 69], [-121, 70], [-140, 73]]
  },
  {
    name: "Central America",
    kind: "continent",
    points: [[-111, 23], [-101, 21], [-93, 18], [-88, 17], [-83, 11], [-78, 9], [-77, 7], [-84, 8], [-90, 14], [-99, 16], [-107, 20]]
  },
  {
    name: "South America",
    kind: "continent",
    points: [[-81, 12], [-74, 11], [-67, 8], [-60, 6], [-52, 1], [-44, -4], [-35, -8], [-38, -16], [-43, -23], [-48, -31], [-54, -40], [-63, -53], [-70, -55], [-73, -49], [-75, -39], [-72, -28], [-77, -17], [-80, -5]]
  },
  {
    name: "Greenland",
    kind: "ice",
    points: [[-73, 77], [-61, 82], [-42, 83], [-23, 78], [-19, 69], [-31, 61], [-47, 60], [-61, 66], [-72, 72]]
  },
  {
    name: "Europe Mainland",
    kind: "continent",
    points: [[-10, 36], [-4, 43], [3, 47], [8, 45], [13, 42], [19, 45], [26, 45], [31, 41], [39, 43], [42, 50], [34, 56], [25, 59], [18, 55], [12, 54], [7, 58], [-1, 56], [-6, 51], [-9, 44]]
  },
  {
    name: "Scandinavia",
    kind: "continent",
    points: [[5, 58], [9, 64], [14, 69], [24, 71], [31, 66], [27, 60], [20, 56], [12, 56]]
  },
  {
    name: "Africa",
    kind: "continent",
    points: [[-18, 36], [-6, 35], [9, 37], [24, 32], [32, 31], [34, 24], [43, 13], [51, 11], [48, 0], [43, -12], [36, -24], [31, -32], [20, -35], [12, -30], [5, -20], [-5, -11], [-14, 4], [-17, 18]]
  },
  {
    name: "Madagascar",
    kind: "continent",
    points: [[47, -12], [50, -18], [49, -25], [45, -26], [43, -20]]
  },
  {
    name: "Asia Mainland",
    kind: "continent",
    points: [[31, 70], [55, 72], [82, 72], [111, 70], [138, 64], [160, 57], [170, 51], [158, 43], [145, 39], [137, 34], [125, 31], [116, 22], [106, 20], [101, 7], [92, 13], [88, 22], [80, 8], [72, 18], [59, 24], [48, 28], [40, 38], [34, 49], [28, 58]]
  },
  {
    name: "Arabia",
    kind: "continent",
    points: [[35, 30], [45, 31], [56, 25], [59, 18], [52, 13], [44, 14], [38, 21]]
  },
  {
    name: "India",
    kind: "continent",
    points: [[68, 29], [78, 30], [88, 25], [89, 20], [82, 13], [77, 7], [72, 12], [68, 22]]
  },
  {
    name: "Southeast Asia",
    kind: "continent",
    points: [[95, 22], [105, 18], [108, 9], [104, 1], [99, 7], [97, 15]]
  },
  {
    name: "Indonesia",
    kind: "continent",
    points: [[96, 5], [113, 2], [128, 0], [141, -5], [133, -8], [116, -6], [101, -3]]
  },
  {
    name: "Japan Archipelago",
    kind: "continent",
    points: [[130, 45], [137, 43], [142, 39], [146, 35], [141, 32], [135, 34], [130, 39]]
  },
  {
    name: "Australia",
    kind: "continent",
    points: [[113, -12], [124, -14], [135, -12], [146, -18], [153, -27], [147, -38], [133, -39], [122, -34], [113, -25]]
  },
  {
    name: "New Zealand",
    kind: "continent",
    points: [[166, -34], [179, -39], [174, -47], [166, -44]]
  },
  {
    name: "United States",
    kind: "country",
    label: "US",
    labelAt: [-98, 39],
    points: [[-125, 49], [-117, 49], [-104, 49], [-95, 48], [-83, 46], [-70, 45], [-67, 41], [-74, 39], [-80, 32], [-81, 25], [-89, 30], [-97, 26], [-106, 31], [-117, 33], [-124, 41]]
  },
  {
    name: "Canada",
    kind: "country",
    label: "CA",
    labelAt: [-104, 58],
    points: [[-140, 70], [-116, 70], [-95, 68], [-75, 64], [-60, 55], [-67, 48], [-84, 47], [-101, 49], [-124, 49], [-132, 55]]
  },
  {
    name: "Mexico",
    kind: "country",
    label: "MX",
    labelAt: [-102, 23],
    points: [[-117, 32], [-107, 31], [-97, 26], [-89, 21], [-95, 16], [-105, 20], [-112, 24]]
  },
  {
    name: "Brazil",
    kind: "country",
    label: "BR",
    labelAt: [-53, -10],
    points: [[-74, 5], [-58, 6], [-44, -3], [-35, -8], [-40, -20], [-48, -31], [-58, -33], [-67, -20], [-70, -8]]
  },
  {
    name: "United Kingdom",
    kind: "country",
    label: "UK",
    labelAt: [-3, 55],
    points: [[-8, 58], [-5, 60], [0, 57], [1, 53], [-2, 50], [-6, 51], [-8, 54]]
  },
  {
    name: "Ireland",
    kind: "country",
    label: "IE",
    labelAt: [-8, 53],
    points: [[-10, 55], [-7, 56], [-6, 53], [-8, 51], [-10, 52]]
  },
  {
    name: "Sweden",
    kind: "country",
    label: "SE",
    labelAt: [16, 62],
    points: [[11, 69], [20, 69], [24, 64], [19, 56], [13, 56], [10, 62]]
  },
  {
    name: "China",
    kind: "country",
    label: "CN",
    labelAt: [104, 35],
    points: [[74, 49], [90, 48], [101, 45], [116, 42], [123, 36], [121, 25], [106, 21], [96, 24], [82, 29], [73, 39]]
  },
  {
    name: "Japan",
    kind: "country",
    label: "JP",
    labelAt: [138, 38],
    points: [[130, 45], [138, 43], [145, 36], [141, 32], [133, 34], [129, 39]]
  },
  {
    name: "Hong Kong",
    kind: "country",
    label: "HK",
    labelAt: [114, 22],
    points: [[113, 23], [115, 23], [115, 21], [113, 21]]
  },
  {
    name: "Australia",
    kind: "country",
    label: "AU",
    labelAt: [134, -25],
    points: [[113, -12], [124, -14], [135, -12], [146, -18], [153, -27], [147, -38], [133, -39], [122, -34], [113, -25]]
  }
];

const WORLD_COUNTRY_LABELS = [
  { name: "Canada", lon: -106, lat: 57, priority: 1 },
  { name: "United States", lon: -98, lat: 39, priority: 1 },
  { name: "Mexico", lon: -102, lat: 23, priority: 2 },
  { name: "Brazil", lon: -53, lat: -10, priority: 1 },
  { name: "Argentina", lon: -64, lat: -34, priority: 2 },
  { name: "Chile", lon: -71, lat: -30, priority: 3 },
  { name: "Peru", lon: -75, lat: -9, priority: 3 },
  { name: "Colombia", lon: -74, lat: 5, priority: 3 },
  { name: "Venezuela", lon: -66, lat: 7, priority: 4 },
  { name: "Cuba", lon: -79, lat: 21, priority: 4 },
  { name: "Greenland", lon: -42, lat: 72, priority: 3 },
  { name: "Iceland", lon: -19, lat: 65, priority: 4 },
  { name: "Ireland", lon: -8, lat: 53, priority: 2 },
  { name: "United Kingdom", lon: -3, lat: 55, priority: 1 },
  { name: "Norway", lon: 9, lat: 62, priority: 3 },
  { name: "Sweden", lon: 16, lat: 62, priority: 2 },
  { name: "Finland", lon: 26, lat: 64, priority: 3 },
  { name: "Denmark", lon: 10, lat: 56, priority: 4 },
  { name: "France", lon: 2, lat: 46, priority: 2 },
  { name: "Spain", lon: -4, lat: 40, priority: 2 },
  { name: "Portugal", lon: -8, lat: 39, priority: 4 },
  { name: "Germany", lon: 10, lat: 51, priority: 2 },
  { name: "Netherlands", lon: 5, lat: 52, priority: 4 },
  { name: "Belgium", lon: 4, lat: 50.5, priority: 4 },
  { name: "Italy", lon: 12, lat: 43, priority: 2 },
  { name: "Poland", lon: 19, lat: 52, priority: 3 },
  { name: "Ukraine", lon: 31, lat: 49, priority: 3 },
  { name: "Turkey", lon: 35, lat: 39, priority: 2 },
  { name: "Russia", lon: 90, lat: 60, priority: 1 },
  { name: "Morocco", lon: -7, lat: 31, priority: 4 },
  { name: "Algeria", lon: 2, lat: 28, priority: 3 },
  { name: "Egypt", lon: 30, lat: 27, priority: 2 },
  { name: "Nigeria", lon: 8, lat: 9, priority: 3 },
  { name: "Ghana", lon: -1, lat: 7, priority: 4 },
  { name: "Ethiopia", lon: 40, lat: 9, priority: 3 },
  { name: "Kenya", lon: 38, lat: 0, priority: 3 },
  { name: "Tanzania", lon: 35, lat: -6, priority: 4 },
  { name: "South Africa", lon: 24, lat: -29, priority: 2 },
  { name: "Madagascar", lon: 47, lat: -20, priority: 4 },
  { name: "Saudi Arabia", lon: 45, lat: 24, priority: 2 },
  { name: "Iran", lon: 53, lat: 32, priority: 2 },
  { name: "Iraq", lon: 44, lat: 33, priority: 4 },
  { name: "Israel", lon: 35, lat: 31, priority: 4 },
  { name: "Pakistan", lon: 69, lat: 30, priority: 3 },
  { name: "India", lon: 78, lat: 22, priority: 1 },
  { name: "Bangladesh", lon: 90, lat: 24, priority: 4 },
  { name: "Sri Lanka", lon: 81, lat: 7, priority: 4 },
  { name: "Kazakhstan", lon: 67, lat: 48, priority: 3 },
  { name: "Mongolia", lon: 103, lat: 47, priority: 3 },
  { name: "China", lon: 104, lat: 35, priority: 1 },
  { name: "Hong Kong", lon: 114, lat: 22, priority: 3 },
  { name: "Taiwan", lon: 121, lat: 24, priority: 4 },
  { name: "Japan", lon: 138, lat: 38, priority: 1 },
  { name: "South Korea", lon: 127, lat: 36, priority: 3 },
  { name: "North Korea", lon: 127, lat: 40, priority: 4 },
  { name: "Thailand", lon: 101, lat: 15, priority: 3 },
  { name: "Vietnam", lon: 108, lat: 16, priority: 3 },
  { name: "Philippines", lon: 122, lat: 12, priority: 3 },
  { name: "Malaysia", lon: 102, lat: 4, priority: 4 },
  { name: "Singapore", lon: 104, lat: 1, priority: 4 },
  { name: "Indonesia", lon: 118, lat: -2, priority: 2 },
  { name: "Australia", lon: 134, lat: -25, priority: 1 },
  { name: "New Zealand", lon: 172, lat: -42, priority: 3 }
];

const WORLD_COUNTRY_BORDER_LINES = [
  [[-125, 49], [-96, 49], [-67, 46]],
  [[-117, 32], [-107, 31], [-97, 26]],
  [[-76, -18], [-70, -29], [-70, -52]],
  [[-67, -20], [-58, -31], [-54, -34]],
  [[-58, 6], [-63, -4], [-67, -15]],
  [[-8, 36], [-3, 43], [3, 43]],
  [[2, 43], [7, 48], [8, 51]],
  [[8, 47], [13, 47], [15, 46]],
  [[14, 55], [18, 54], [24, 55]],
  [[19, 52], [24, 49], [31, 49]],
  [[26, 45], [31, 46], [38, 45]],
  [[34, 36], [38, 39], [43, 41]],
  [[-9, 31], [2, 31], [12, 32], [24, 31]],
  [[24, 31], [25, 22], [30, 22]],
  [[9, 13], [14, 13], [16, 5], [14, -3]],
  [[30, 4], [36, 4], [42, 5]],
  [[25, -22], [31, -22], [33, -30]],
  [[35, 30], [42, 31], [48, 28]],
  [[45, 31], [51, 31], [58, 28]],
  [[61, 25], [70, 30], [78, 30]],
  [[69, 24], [75, 31], [78, 35]],
  [[78, 30], [88, 28], [95, 27]],
  [[74, 49], [89, 49], [101, 45], [119, 43]],
  [[88, 49], [96, 42], [106, 42]],
  [[100, 23], [106, 20], [109, 12]],
  [[108, 22], [114, 22], [121, 24]],
  [[127, 34], [129, 38], [128, 42]],
  [[96, 5], [107, 2], [119, 0], [131, -4]],
  [[113, -25], [124, -30], [134, -25], [146, -30]]
];

const WORLD_ATLAS_URLS = [
  "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-50m.json",
  "https://unpkg.com/world-atlas@2/countries-50m.json"
];

const WORLD_FILTER_STORAGE_KEY = "radiox.worldFilter";
const WORLD_FILTERS = new Set(["million", "grammy", "taste"]);
const WORLD_ERA_STORAGE_KEY = "radiox.worldEra";
const WORLD_ERAS = new Set(["all", "60s", "70s", "80s", "90s", "00s", "now"]);
const WORLD_COUNTRY_TASTE_MIN = 55;
const WORLD_COUNTRY_ALIASES = new Map([
  ["united states of america", "United States"],
  ["russian federation", "Russia"],
  ["korea, republic of", "South Korea"],
  ["republic of korea", "South Korea"]
]);
const WORLD_TOUR_FUTURE_DAYS = 730;
const WORLD_GRAMMY_ALBUMS = new Map([
  ["the-beatles:Sgt. Pepper's Lonely Hearts Club Band", { year: 1968, award: "Album of the Year" }],
  ["u2:The Joshua Tree", { year: 1988, award: "Album of the Year" }],
  ["adele:21", { year: 2012, award: "Album of the Year" }],
  ["adele:25", { year: 2017, award: "Album of the Year" }],
  ["fleetwood-mac:Rumours", { year: 1978, award: "Album of the Year" }],
  ["michael-jackson:Thriller", { year: 1984, award: "Album of the Year" }],
  ["bob-dylan:Time Out Of Mind", { year: 1998, award: "Album of the Year" }],
  ["bruce-springsteen:The Rising", { year: 2003, award: "Best Rock Album" }],
  ["green-day:American Idiot", { year: 2005, award: "Best Rock Album" }],
  ["green-day:21st Century Breakdown", { year: 2010, award: "Best Rock Album" }],
  ["green-day:Dookie", { year: 1995, award: "Best Alternative Music Performance" }],
  ["foo-fighters:Wasting Light", { year: 2012, award: "Best Rock Album" }],
  ["foo-fighters:Echoes, Silence, Patience & Grace", { year: 2008, award: "Best Rock Album" }],
  ["foo-fighters:Medicine At Midnight", { year: 2022, award: "Best Rock Album" }],
  ["red-hot-chili-peppers:Stadium Arcadium", { year: 2007, award: "Best Rock Album" }],
  ["radiohead:OK Computer", { year: 1998, award: "Best Alternative Music Performance" }],
  ["radiohead:Kid A", { year: 2001, award: "Best Alternative Music Album" }],
  ["radiohead:In Rainbows", { year: 2009, award: "Best Alternative Music Album" }],
  ["the-white-stripes:Elephant", { year: 2004, award: "Best Alternative Music Album" }],
  ["the-white-stripes:Get Behind Me Satan", { year: 2006, award: "Best Alternative Music Album" }],
  ["the-white-stripes:Icky Thump", { year: 2008, award: "Best Alternative Music Album" }],
  ["coldplay:Viva La Vida Or Death And All His Friends", { year: 2009, award: "Best Rock Album" }],
  ["santana:Supernatural", { year: 2000, award: "Album of the Year" }],
  ["daft-punk:Random Access Memories", { year: 2014, award: "Album of the Year" }],
  ["norah-jones:Come Away With Me", { year: 2003, award: "Album of the Year" }],
  ["bb-king:Riding With The King", { year: 2001, award: "Best Traditional Blues Album" }],
  ["bb-king:Blues On The Bayou", { year: 2000, award: "Best Traditional Blues Album" }],
  ["herbie-hancock:River: The Joni Letters", { year: 2008, award: "Album of the Year" }],
  ["yo-yo-ma:Obrigado Brazil", { year: 2004, award: "Best Classical Crossover Album" }]
]);

function normalizeWorldFilter(value) {
  if (value === "sales" || value === "all") return "million";
  return WORLD_FILTERS.has(value) ? value : "million";
}

function worldBands() {
  return Array.isArray(window.RADIOX_WORLD_BANDS)
    ? [...window.RADIOX_WORLD_BANDS]
      .sort((a, b) => Number(b.claimedSalesM || 0) - Number(a.claimedSalesM || 0) || a.name.localeCompare(b.name))
      .map((band, index) => ({ ...band, salesRank: band.claimedSalesM ? index + 1 : null }))
    : [];
}

function worldAlbumKey(band, album) {
  return `${band?.id || ""}:${album?.title || ""}`;
}

function albumGrammyMeta(band, album) {
  return album?.grammy || WORLD_GRAMMY_ALBUMS.get(worldAlbumKey(band, album)) || null;
}

function tasteProfileForWorld() {
  return app.payload?.profile || {};
}

function normalizedTasteWords(values) {
  return (values || [])
    .flatMap((value) => String(value || "").toLowerCase().split(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/))
    .filter(Boolean);
}

function albumTasteMatch(band, album, profile = tasteProfileForWorld()) {
  const anchors = (profile.tasteAnchors || []).map((value) => String(value || "").toLowerCase());
  const genres = band.genres || [];
  const genreWeights = profile.genreWeights || {};
  const currentLean = new Set((profile.currentLean || []).map(String));
  const currentDayPart = app.payload?.context?.now?.dayPart || "day";
  const timeGenres = new Set((profile.timePreferences?.[currentDayPart]?.genres || []).map(String));
  const albumWords = normalizedTasteWords([album.title, album.lead, ...(album.tracks || [])]);
  const bandName = String(band.name || "").toLowerCase();
  const anchorMatch = anchors.some((anchor) => anchor && (bandName.includes(anchor) || anchor.includes(bandName)));
  const genreScore = genres.reduce((sum, genre) => sum + Number(genreWeights[genre] || 0), 0);
  const weightedGenreScore = genres.length ? Math.min(30, Math.round(genreScore / genres.length * 1.25)) : 0;
  const leanHits = genres.filter((genre) => currentLean.has(genre)).length;
  const timeHits = genres.filter((genre) => timeGenres.has(genre)).length;
  const classicWords = ["blues", "jazz", "bach", "cello", "river", "dark", "time", "wish", "blue", "故乡", "安和桥"];
  const albumWordHit = albumWords.some((word) => classicWords.includes(word));

  let score = 38;
  const reasons = [];
  if (anchorMatch) {
    score += 28;
    reasons.push("artist anchor");
  }
  if (band.taste) {
    score += 10;
    if (!anchorMatch) reasons.push("taste layer");
  }
  if (weightedGenreScore) {
    score += weightedGenreScore;
    reasons.push("genre weight");
  }
  if (leanHits) {
    score += Math.min(12, leanHits * 6);
    reasons.push("current lean");
  }
  if (timeHits) {
    score += Math.min(10, timeHits * 5);
    reasons.push("time preference");
  }
  if (albumWordHit) {
    score += 4;
    reasons.push("album mood");
  }
  if (albumGrammyMeta(band, album)) score += 2;
  if (band.claimedSalesM) score += Math.min(5, Math.round(Number(band.claimedSalesM) / 80));

  return {
    score: clampValue(score, 36, 99),
    reason: reasons.slice(0, 2).join(" + ") || "taste distance"
  };
}

function bandBestTasteMatch(band) {
  const entries = worldAlbumsForBand(band);
  if (!entries.length) return { score: 0, reason: "" };
  return entries
    .map(({ album }) => albumTasteMatch(band, album))
    .sort((a, b) => b.score - a.score)[0];
}

function bandCatalogTasteMatch(band) {
  const albums = band?.albums || [];
  if (!albums.length) return { score: 0, reason: "" };
  return albums
    .map((album) => albumTasteMatch(band, album))
    .sort((a, b) => b.score - a.score)[0];
}

function worldTasteFieldSignature() {
  const profile = tasteProfileForWorld();
  return JSON.stringify({
    anchors: profile.tasteAnchors || [],
    lean: profile.currentLean || [],
    weights: profile.genreWeights || {},
    time: profile.timePreferences?.[app.payload?.context?.now?.dayPart || "day"]?.genres || []
  });
}

function worldTasteField() {
  const signature = worldTasteFieldSignature();
  if (app.worldTasteFieldCache?.signature === signature) return app.worldTasteFieldCache.map;

  const grouped = new Map();
  worldBands().forEach((band) => {
    const score = bandCatalogTasteMatch(band).score;
    bandWorldCountries(band).forEach((country) => {
      const key = canonicalWorldCountry(country).toLowerCase();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(score);
    });
  });

  const map = new Map([...grouped].map(([country, scores]) => {
    const strongest = scores.sort((a, b) => b - a).slice(0, 3);
    const score = Math.round(strongest.reduce((sum, value) => sum + value, 0) / strongest.length);
    return [country, { score, count: scores.length }];
  }));
  app.worldTasteFieldCache = { signature, map };
  return map;
}

function countryTasteMatch(countryName) {
  return worldTasteField().get(canonicalWorldCountry(countryName).toLowerCase()) || null;
}

function tasteMatchTier(score) {
  if (score >= 80) return "match-high";
  if (score >= 65) return "match-discovery";
  return "match-distant";
}

function countryTasteOverlay(score) {
  if (score >= 80) return "rgba(57,245,176,0.28)";
  if (score >= 65) return "rgba(247,201,92,0.22)";
  return "rgba(151,231,255,0.1)";
}

function worldAlbumFilterLabel() {
  if (app.worldCountryName) return "COUNTRY TASTE";
  if (app.worldFilter === "grammy") return "GRAMMY";
  if (app.worldFilter === "taste") return "TASTE";
  return "MILLION";
}

function worldAlbumNote(band, album) {
  if (app.worldCountryName) return "Country Taste";
  const grammy = albumGrammyMeta(band, album);
  if (app.worldFilter === "grammy" && grammy) return `${grammy.year} Grammy · ${grammy.award}`;
  if (app.worldFilter === "taste") return "Taste Map";
  return band.claimedSalesM ? "Million-selling album" : "Album layer";
}

function albumMatchesWorldFilter(band, album) {
  if (!album) return false;
  if (app.worldFilter === "grammy") return Boolean(albumGrammyMeta(band, album));
  if (app.worldFilter === "taste") return Boolean(band.taste);
  return Boolean(band.claimedSalesM || album.million);
}

function albumMatchesWorldEra(album) {
  const era = WORLD_ERAS.has(app.worldEra) ? app.worldEra : "all";
  if (era === "all") return true;
  const year = Number(album?.year || albumGrammyMeta(null, album)?.year || 0);
  if (!year) return false;
  if (era === "now") return year >= 2010;
  const start = era === "00s" ? 2000 : 1900 + Number.parseInt(era, 10);
  return year >= start && year < start + 10;
}

function worldAlbumsForBand(band) {
  const entries = (band?.albums || [])
    .map((album, albumIndex) => ({ album, albumIndex, note: worldAlbumNote(band, album) }))
    .filter((entry) => albumMatchesWorldEra(entry.album));
  return app.worldCountryName ? entries : entries.filter((entry) => albumMatchesWorldFilter(band, entry.album));
}

function canonicalWorldCountry(value) {
  const name = String(value || "").trim();
  return WORLD_COUNTRY_ALIASES.get(name.toLowerCase()) || name;
}

function bandWorldCountries(band) {
  return String(band?.country || "")
    .split("/")
    .map(canonicalWorldCountry)
    .filter(Boolean);
}

function bandMatchesWorldCountry(band, countryName = app.worldCountryName) {
  const target = canonicalWorldCountry(countryName).toLowerCase();
  return !target || bandWorldCountries(band).some((name) => name.toLowerCase() === target);
}

function worldLayerBands() {
  return worldBands().filter((band) => worldAlbumsForBand(band).length);
}

function filteredWorldBands() {
  const bands = worldLayerBands();
  if (!app.worldCountryName) return bands;
  return bands
    .filter((band) => bandMatchesWorldCountry(band))
    .map((band) => ({ band, match: bandBestTasteMatch(band).score }))
    .filter((entry) => entry.match >= WORLD_COUNTRY_TASTE_MIN)
    .sort((a, b) => b.match - a.match || a.band.name.localeCompare(b.band.name))
    .slice(0, worldRingLabelLimit())
    .map((entry) => entry.band);
}

function worldAlbumEntries() {
  const entries = filteredWorldBands().flatMap((band) => (
    worldAlbumsForBand(band).map((entry) => ({ ...entry, band }))
  ));
  if (app.worldFilter === "grammy") {
    return entries.sort((a, b) => {
      const yearA = Number(albumGrammyMeta(a.band, a.album)?.year || 9999);
      const yearB = Number(albumGrammyMeta(b.band, b.album)?.year || 9999);
      return yearA - yearB || a.band.name.localeCompare(b.band.name);
    });
  }
  return entries;
}

function selectedWorldBand() {
  const bands = filteredWorldBands();
  return bands.find((band) => band.id === app.worldBandId) || bands[0] || null;
}

function worldBandById(id) {
  if (!id) return null;
  return filteredWorldBands().find((band) => band.id === id) || null;
}

function activeWorldBand() {
  return worldBandById(app.worldHoverBandId) || selectedWorldBand();
}

function focusedWorldBandId() {
  return app.worldHoverBandId || app.worldBandId || "";
}

function worldRankEntriesForBand(band) {
  if (!band) return worldAlbumEntries();
  const albums = worldAlbumsForBand(band);
  return albums.length
    ? albums.map((entry) => ({ ...entry, band }))
    : worldAlbumEntries();
}

function worldTourDataForBand(band) {
  if (!band) return null;
  const catalog = window.RADIOX_WORLD_TOURS || {};
  return catalog[band.id] || band.tour || null;
}

function parseTourDate(value) {
  const date = new Date(`${value || ""}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function tourWindowBounds() {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const end = addDays(now, WORLD_TOUR_FUTURE_DAYS);
  end.setHours(23, 59, 59, 999);
  return {
    start: now,
    end
  };
}

function stopInTourWindow(stop) {
  const startDate = parseTourDate(stop?.date);
  const endDate = parseTourDate(stop?.endDate || stop?.date);
  if (!startDate || !endDate) return false;
  const bounds = tourWindowBounds();
  return endDate >= bounds.start && startDate <= bounds.end;
}

function tourStopsForBand(band) {
  const data = worldTourDataForBand(band);
  return (data?.stops || [])
    .filter(stopInTourWindow)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));
}

function shortTourDate(value) {
  const date = parseTourDate(value);
  if (!date) return "";
  const year = String(date.getFullYear()).slice(2);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}.${month}.${day}`;
}

function tourStopDateLabel(stop) {
  const start = shortTourDate(stop?.date);
  const end = stop?.endDate ? shortTourDate(stop.endDate) : "";
  if (start && end && start !== end) return `${start}-${end}`;
  return start || "date tbc";
}

function tourStopCityLabel(stop) {
  return [stop?.city, stop?.region, stop?.country].filter(Boolean).join(", ");
}

function tourStopTitle(stop) {
  return [
    tourStopDateLabel(stop),
    tourStopCityLabel(stop),
    stop?.venue
  ].filter(Boolean).join(" · ");
}

function tourTooltipStopsForBand(band) {
  return tourStopsForBand(band).slice(0, 5);
}

function hideWorldTourTooltip() {
  if (!els.worldTourTooltip) return;
  els.worldTourTooltip.hidden = true;
  els.worldTourTooltip.innerHTML = "";
}

function positionWorldTourTooltip(event) {
  if (!els.worldTourTooltip || !els.worldGlobe) return;
  const stage = els.worldGlobe.parentElement || els.worldGlobe;
  const rect = stage.getBoundingClientRect();
  const tooltip = els.worldTourTooltip;
  const margin = 10;
  const width = tooltip.offsetWidth || 260;
  const height = tooltip.offsetHeight || 140;
  const pointerX = event ? event.clientX - rect.left : rect.width * 0.5;
  const pointerY = event ? event.clientY - rect.top : rect.height * 0.45;
  let x = pointerX + 16;
  let y = pointerY - height * 0.5;
  if (x + width + margin > rect.width) x = pointerX - width - 16;
  x = clampValue(x, margin, Math.max(margin, rect.width - width - margin));
  y = clampValue(y, margin, Math.max(margin, rect.height - height - margin));
  tooltip.style.left = `${x}px`;
  tooltip.style.top = `${y}px`;
}

function showWorldTourTooltip(band, event) {
  if (!els.worldTourTooltip || !band) return hideWorldTourTooltip();
  const stops = tourTooltipStopsForBand(band);
  if (!stops.length) return hideWorldTourTooltip();
  const data = worldTourDataForBand(band);
  const source = data?.sourceLabel ? `<small class="tour-tooltip-source">${escapeHtml(data.sourceLabel)}</small>` : "";
  els.worldTourTooltip.innerHTML = `
    <strong>${escapeHtml(band.name)}</strong>
    <small>${escapeHtml(data?.name || "Upcoming tour")} · ${stops.length}${tourStopsForBand(band).length > stops.length ? "+" : ""} future stops</small>
    <div>
      ${stops.map((stop) => `
        <p>
          <time>${escapeHtml(tourStopDateLabel(stop))}</time>
          <span>${escapeHtml(tourStopCityLabel(stop))}</span>
          <em>${escapeHtml([stop.venue, stop.source?.label].filter(Boolean).join(" · "))}</em>
        </p>
      `).join("")}
    </div>
    ${source}
  `;
  els.worldTourTooltip.hidden = false;
  positionWorldTourTooltip(event);
}

function tourStatusHeading(data, stops = []) {
  if (data?.stops?.length && !stops.length) return "No tour inside current window";
  if (!data) return "Tour data not added yet";
  if (data.status === "inactive") return "Historical / inactive artist";
  if (data.status === "retired") return "Retired from touring";
  if (data.status === "no-recent") return "No recent tour found";
  if (data.status === "data-missing") return "Tour data not added yet";
  return "No verified recent tour";
}

function tourStatusCopy(band, data, stops = []) {
  if (data?.stops?.length && !stops.length) {
    return `${band.name} 有巡演记录，但不在当前“近两年/已公布下一段”的显示窗口里。`;
  }
  if (data?.status === "inactive") {
    return `${band.name} 目前属于历史/非活跃巡演状态，地图不会把旧巡演当成近两年巡演显示。`;
  }
  if (data?.status === "retired") {
    return `${band.name} 已结束或取消巡演计划，地图保留这个状态，避免误以为只是没有查到。`;
  }
  if (data?.status === "no-recent") {
    return `${band.name} 近两年或已公布下一段没有可核验的巡演城市。`;
  }
  return `${band.name} 的巡演数据还没有补进本地地图；补充后会在这里显示日期、城市和路线。`;
}

function tourProjection(stop) {
  const point = projectWorldPoint(stop.lon, stop.lat, WORLD_GLOBE_MARKER_RADIUS * app.worldZoom, 50);
  const inFrame = point.x > -8 && point.x < 108 && point.y > -8 && point.y < 108;
  return {
    ...point,
    visible: point.visible && inFrame,
    scale: 0.72 + Math.max(0, point.depth) * 0.3,
    z: Math.round(point.depth * 80)
  };
}

function decodeTopoArcs(topology) {
  const scale = topology?.transform?.scale || [1, 1];
  const translate = topology?.transform?.translate || [0, 0];
  return (topology?.arcs || []).map((arc) => {
    let x = 0;
    let y = 0;
    return arc.map((point) => {
      x += Number(point[0] || 0);
      y += Number(point[1] || 0);
      return [
        x * scale[0] + translate[0],
        y * scale[1] + translate[1]
      ];
    });
  });
}

function topoArcPoints(decodedArcs, arcIndex) {
  const index = arcIndex < 0 ? ~arcIndex : arcIndex;
  const points = decodedArcs[index] || [];
  return arcIndex < 0 ? [...points].reverse() : points;
}

function topoRingPoints(decodedArcs, ring) {
  const points = [];
  (ring || []).forEach((arcIndex, index) => {
    const arc = topoArcPoints(decodedArcs, arcIndex);
    points.push(...(index ? arc.slice(1) : arc));
  });
  return points;
}

function topoGeometryRings(decodedArcs, geometry) {
  if (geometry?.type === "Polygon") {
    return (geometry.arcs || []).map((ring) => topoRingPoints(decodedArcs, ring));
  }
  if (geometry?.type === "MultiPolygon") {
    return (geometry.arcs || []).flatMap((polygon) => (polygon || []).map((ring) => topoRingPoints(decodedArcs, ring)));
  }
  return [];
}

function topoCountries(topology) {
  const decodedArcs = decodeTopoArcs(topology);
  const geometries = topology?.objects?.countries?.geometries || [];
  return geometries.map((geometry) => ({
    id: String(geometry.id || ""),
    name: geometry.properties?.name || geometry.properties?.NAME || "",
    rings: topoGeometryRings(decodedArcs, geometry).filter((ring) => ring.length >= 3)
  })).filter((country) => country.rings.length);
}

function pointInWorldRing(lon, lat, ring) {
  let inside = false;
  const points = [];
  (ring || []).forEach(([pointLon, pointLat]) => {
    let unwrappedLon = Number(pointLon);
    const previousLon = points.at(-1)?.[0];
    if (Number.isFinite(previousLon)) {
      while (unwrappedLon - previousLon > 180) unwrappedLon -= 360;
      while (unwrappedLon - previousLon < -180) unwrappedLon += 360;
    }
    points.push([unwrappedLon, Number(pointLat)]);
  });
  if (!points.length) return false;
  let testLon = Number(lon);
  const referenceLon = points.reduce((sum, point) => sum + point[0], 0) / points.length;
  while (testLon - referenceLon > 180) testLon -= 360;
  while (testLon - referenceLon < -180) testLon += 360;
  for (let index = 0, previous = points.length - 1; index < points.length; previous = index, index += 1) {
    const [x1, y1] = points[index];
    const [x2, y2] = points[previous];
    const crosses = (y1 > lat) !== (y2 > lat)
      && testLon < ((x2 - x1) * (lat - y1)) / (y2 - y1) + x1;
    if (crosses) inside = !inside;
  }
  return inside;
}

function worldCountryAt(lon, lat) {
  const atlasCountry = app.worldCountries.find((country) => (
    country.rings.some((ring) => pointInWorldRing(lon, lat, ring))
  ));
  if (atlasCountry?.name) return canonicalWorldCountry(atlasCountry.name);

  const nearest = WORLD_COUNTRY_LABELS
    .map((country) => ({
      ...country,
      distance: Math.hypot(normalizeDegrees(country.lon - lon) * Math.cos(lat * Math.PI / 180), country.lat - lat)
    }))
    .sort((a, b) => a.distance - b.distance)[0];
  return nearest?.distance <= 16 ? canonicalWorldCountry(nearest.name) : "";
}

async function loadWorldAtlas() {
  if (app.worldAtlasLoading || app.worldCountries.length) return;
  app.worldAtlasLoading = true;
  for (const url of WORLD_ATLAS_URLS) {
    try {
      const response = await fetch(url, { cache: "force-cache" });
      if (!response.ok) throw new Error(`${response.status}`);
      const topology = await response.json();
      const countries = topoCountries(topology);
      if (!countries.length) throw new Error("No countries in topology");
      app.worldCountries = countries;
      app.worldAtlasSource = url;
      app.worldAtlasLoading = false;
      refreshWorldGlobe();
      return;
    } catch (error) {
      console.warn("World atlas load skipped", url, error);
    }
  }
  app.worldAtlasSource = "fallback";
  app.worldAtlasLoading = false;
}

function projectWorldPoint(lonDeg, latDeg, radius = 50, center = 50) {
  const lat = Number(latDeg || 0) * Math.PI / 180;
  const lon = (Number(lonDeg || 0) - app.worldCenterLon) * Math.PI / 180;
  const centerLat = app.worldCenterLat * Math.PI / 180;
  const cosLat = Math.cos(lat);
  const sinLat = Math.sin(lat);
  const cosCenter = Math.cos(centerLat);
  const sinCenter = Math.sin(centerLat);
  const cosc = sinCenter * sinLat + cosCenter * cosLat * Math.cos(lon);
  const x = center + radius * cosLat * Math.sin(lon);
  const y = center - radius * (cosCenter * sinLat - sinCenter * cosLat * Math.cos(lon));
  const depth = (cosc + 1) / 2;
  return {
    x,
    y,
    cosc,
    visible: cosc > -0.03,
    depth: Math.max(0.05, Math.min(1, depth))
  };
}

function worldPointFromClient(clientX, clientY) {
  const rect = els.worldGlobe?.getBoundingClientRect();
  if (!rect?.width || !rect?.height) return null;
  const radius = Math.min(rect.width, rect.height) * WORLD_GLOBE_RADIUS_RATIO * app.worldZoom;
  const x = (clientX - rect.left - rect.width / 2) / radius;
  const y = (rect.top + rect.height / 2 - clientY) / radius;
  const rho = Math.hypot(x, y);
  if (rho > 1) return null;
  if (rho < 0.00001) return { lon: app.worldCenterLon, lat: app.worldCenterLat };

  const centerLat = app.worldCenterLat * Math.PI / 180;
  const c = Math.asin(rho);
  const sinC = Math.sin(c);
  const cosC = Math.cos(c);
  const lat = Math.asin(cosC * Math.sin(centerLat) + (y * sinC * Math.cos(centerLat)) / rho);
  const lon = app.worldCenterLon * Math.PI / 180 + Math.atan2(
    x * sinC,
    rho * Math.cos(centerLat) * cosC - y * Math.sin(centerLat) * sinC
  );
  return { lon: normalizeDegrees(lon * 180 / Math.PI), lat: lat * 180 / Math.PI };
}

function worldProjection(band) {
  const point = projectWorldPoint(band.lon, band.lat, WORLD_GLOBE_MARKER_RADIUS * app.worldZoom, 50);
  const visibleDepth = point.visible ? point.depth : 0.05;
  const inFrame = point.x > -8 && point.x < 108 && point.y > -8 && point.y < 108;
  return {
    ...point,
    visible: point.visible && inFrame,
    scale: 0.72 + Math.max(0, visibleDepth) * 0.42 + Math.min(0.5, Number(band.claimedSalesM || 0) / 900),
    z: Math.round(visibleDepth * 80)
  };
}

function worldRingLabelLimit() {
  if (window.innerWidth <= 520) return app.worldFullscreen ? 8 : 7;
  if (app.worldFullscreen) return 18;
  if (app.worldFilter === "taste") return 12;
  return 10;
}

function worldRingLabelPriority(band) {
  const match = bandBestTasteMatch(band).score;
  const salesRank = Number(band.salesRank || 999);
  const salesScore = band.salesRank ? Math.max(0, 120 - salesRank * 2) : 0;
  const grammyScore = worldAlbumsForBand(band).some(({ album }) => albumGrammyMeta(band, album)) ? 80 : 0;
  const tasteScore = band.taste ? 90 : 0;
  if (band.id === app.worldBandId) return 10000;
  if (band.id === app.worldHoverBandId) return 9000;
  if (app.worldFilter === "grammy") return grammyScore + match;
  if (app.worldFilter === "taste") return tasteScore + match;
  return salesScore + match;
}

function worldRingLabelBands(bands, pointMap) {
  const limit = worldRingLabelLimit();
  const visible = (bands || [])
    .map((band) => ({ band, point: pointMap.get(band.id) || worldProjection(band) }))
    .sort((a, b) => (
      worldRingLabelPriority(b.band) - worldRingLabelPriority(a.band)
      || a.band.name.localeCompare(b.band.name)
    ))
    .slice(0, limit)
    .map((entry) => entry.band);

  [app.worldBandId, app.worldHoverBandId].filter(Boolean).forEach((id) => {
    const band = (bands || []).find((item) => item.id === id);
    if (band && !visible.some((item) => item.id === band.id)) visible.unshift(band);
  });

  return [...new Map(visible.map((band) => [band.id, band])).values()].slice(0, limit);
}

function worldRingSlotMap(bands, pointMap) {
  return new Map(worldRingLabelBands(bands, pointMap).map((band, index, source) => [
    band.id,
    { index, count: source.length }
  ]));
}

function worldRingLabelProjection(point, band, slot = null) {
  const dx = Number(point?.x || 50) - 50;
  const dy = Number(point?.y || 50) - 50;
  const distance = Math.hypot(dx, dy);
  const fallbackAngle = ((((Number(band?.salesRank || 1) * 137.5) % 360) - 90) * Math.PI) / 180;
  const slotCount = Math.max(1, Number(slot?.count || 0));
  const angle = slot && slot.count > 1
    ? (-Math.PI / 2) + (Math.PI / slotCount) + ((slot.index / slotCount) * Math.PI * 2)
    : distance > 4 ? Math.atan2(dy, dx) : fallbackAngle;
  const radius = app.worldFullscreen ? 46.2 : 43.6;
  const x = clampValue(50 + Math.cos(angle) * radius, 8, 92);
  const y = clampValue(50 + Math.sin(angle) * radius, 8, 92);
  return {
    x,
    y,
    anchor: x < 26 ? "left" : x > 74 ? "right" : "center"
  };
}

function shouldShowWorldRingLabel(band, slotMap) {
  return Boolean(band?.id && slotMap.has(band.id));
}

function worldBandPointMap(bands) {
  const items = (bands || []).map((band) => ({
    band,
    point: worldProjection(band)
  }));
  const clusters = [];
  const spreadTrigger = app.worldFullscreen ? 4.2 : 4.8;

  items
    .filter((item) => item.point.visible)
    .forEach((item) => {
      const cluster = clusters.find((candidate) => (
        Math.hypot(item.point.x - candidate.x, item.point.y - candidate.y) <= spreadTrigger
      ));
      if (cluster) {
        cluster.items.push(item);
        cluster.x = cluster.items.reduce((sum, next) => sum + next.point.x, 0) / cluster.items.length;
        cluster.y = cluster.items.reduce((sum, next) => sum + next.point.y, 0) / cluster.items.length;
      } else {
        clusters.push({ x: item.point.x, y: item.point.y, items: [item] });
      }
    });

  clusters.forEach((cluster) => {
    if (cluster.items.length <= 1) return;
    const sorted = cluster.items.sort((a, b) => (
      Number(b.band.claimedSalesM || 0) - Number(a.band.claimedSalesM || 0)
      || a.band.name.localeCompare(b.band.name)
    ));
    const maxSpread = app.worldFullscreen ? 7.8 : 6.2;
    const baseSpread = app.worldFullscreen ? 2.45 : 2.15;
    const spreadStep = app.worldFullscreen ? 1.12 : 0.92;
    const angleStep = Math.PI * (3 - Math.sqrt(5));
    sorted.forEach((item, index) => {
      const angle = -Math.PI / 2 + index * angleStep;
      const spread = clampValue(baseSpread + Math.sqrt(index) * spreadStep, 2.3, maxSpread);
      item.point = {
        ...item.point,
        x: clampValue(cluster.x + Math.cos(angle) * spread, -6, 106),
        y: clampValue(cluster.y + Math.sin(angle) * spread, -6, 106),
        z: item.point.z + index,
        clusterSize: sorted.length,
        clusterIndex: index
      };
    });
  });

  return new Map(items.map((item) => [item.band.id, item.point]));
}

function resizeWorldCanvas() {
  const canvas = els.worldCanvas;
  if (!canvas) return null;
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(1, Math.round(rect.width * dpr));
  const height = Math.max(1, Math.round(rect.height * dpr));
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  return { canvas, width, height, dpr };
}

function projectCanvasPoint(lon, lat, cx, cy, radius) {
  const point = projectWorldPoint(lon, lat, radius, 0);
  return {
    x: cx + point.x,
    y: cy + point.y,
    visible: point.visible,
    cosc: point.cosc,
    depth: point.depth
  };
}

function drawProjectedPolyline(ctx, points, cx, cy, radius, closePath = false) {
  let drawing = false;
  let drew = false;
  points.forEach(([lon, lat]) => {
    const projected = projectCanvasPoint(lon, lat, cx, cy, radius);
    if (!projected.visible) {
      drawing = false;
      return;
    }
    if (!drawing) {
      ctx.moveTo(projected.x, projected.y);
      drawing = true;
    } else {
      ctx.lineTo(projected.x, projected.y);
    }
    drew = true;
  });
  if (closePath && drew && drawing) ctx.closePath();
  return drew;
}

function drawWorldGraticule(ctx, cx, cy, radius) {
  ctx.save();
  ctx.lineWidth = Math.max(0.7, radius / 260);
  ctx.strokeStyle = "rgba(247,244,232,0.14)";
  for (let lon = -180; lon <= 180; lon += 30) {
    const line = [];
    for (let lat = -80; lat <= 80; lat += 4) line.push([lon, lat]);
    ctx.beginPath();
    if (drawProjectedPolyline(ctx, line, cx, cy, radius)) ctx.stroke();
  }
  for (let lat = -60; lat <= 60; lat += 20) {
    const line = [];
    for (let lon = -180; lon <= 180; lon += 4) line.push([lon, lat]);
    ctx.beginPath();
    if (drawProjectedPolyline(ctx, line, cx, cy, radius)) ctx.stroke();
  }
  ctx.restore();
}

function atlasCountryFill(country) {
  if (/antarctica/i.test(country.name)) return "rgba(226,242,241,0.5)";
  const seed = parseInt(stableVoiceHash(country.name).slice(0, 6), 36) || 0;
  const [hue, saturation, lightness] = WORLD_COUNTRY_PALETTE[seed % WORLD_COUNTRY_PALETTE.length];
  const shiftedHue = (hue + Math.floor(seed / WORLD_COUNTRY_PALETTE.length) % 10 - 5 + 360) % 360;
  const shiftedLightness = clampValue(lightness + (seed % 7) - 3, 35, 54);
  return `hsla(${shiftedHue}, ${saturation}%, ${shiftedLightness}%, 0.86)`;
}

function drawWorldAtlasCountries(ctx, cx, cy, radius) {
  if (!app.worldCountries.length) return false;
  ctx.save();
  app.worldCountries.forEach((country) => {
    const focused = canonicalWorldCountry(country.name).toLowerCase() === canonicalWorldCountry(app.worldCountryName).toLowerCase();
    const dimmed = Boolean(app.worldCountryName) && !focused;
    const taste = countryTasteMatch(country.name);
    country.rings.forEach((ring) => {
      ctx.beginPath();
      const drew = drawProjectedPolyline(ctx, ring, cx, cy, radius, true);
      if (!drew) return;
      ctx.globalAlpha = dimmed ? 0.32 : 1;
      ctx.fillStyle = focused ? "rgba(57,245,176,0.92)" : atlasCountryFill(country);
      ctx.fill();
      if (!focused && taste) {
        ctx.fillStyle = countryTasteOverlay(taste.score);
        ctx.fill();
      }
      ctx.lineWidth = focused ? Math.max(2, radius / 150) : Math.max(0.55, radius / 420);
      ctx.strokeStyle = focused ? "rgba(255,255,255,0.92)" : "rgba(247,244,232,0.3)";
      ctx.stroke();
      ctx.globalAlpha = 1;
    });
  });
  ctx.restore();
  return true;
}

function drawWorldCountryBorderLines(ctx, cx, cy, radius) {
  ctx.save();
  ctx.globalAlpha = 0.36;
  ctx.strokeStyle = "rgba(247,244,232,0.28)";
  ctx.lineWidth = Math.max(0.65, radius / 360);
  WORLD_COUNTRY_BORDER_LINES.forEach((line) => {
    ctx.beginPath();
    if (drawProjectedPolyline(ctx, line, cx, cy, radius)) ctx.stroke();
  });
  ctx.restore();
}

function countryLabelVisible(label) {
  if (label.priority <= 1) return label.depth > 0.22;
  if (label.priority === 2) return label.depth > 0.34;
  if (label.priority === 3) return label.depth > 0.46;
  return label.depth > 0.58;
}

function boxesOverlap(a, b, padding = 3) {
  return !(
    a.x + a.width + padding < b.x
    || b.x + b.width + padding < a.x
    || a.y + a.height + padding < b.y
    || b.y + b.height + padding < a.y
  );
}

function drawWorldCountryLabels(ctx, cx, cy, radius) {
  const fontFamily = getComputedStyle(document.documentElement).getPropertyValue("--font-mono") || "monospace";
  const maxLabels = Math.round(clampValue(radius / 5.2, 24, 58));
  const occupied = [];
  const labels = WORLD_COUNTRY_LABELS
    .map((item) => {
      const projected = projectCanvasPoint(item.lon, item.lat, cx, cy, radius);
      return { ...item, ...projected };
    })
    .filter((item) => item.visible && countryLabelVisible(item))
    .sort((a, b) => (a.priority - b.priority) || (b.depth - a.depth));

  ctx.save();
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  let drawn = 0;
  labels.forEach((label) => {
    if (drawn >= maxLabels) return;
    const fontSize = Math.max(
      label.priority <= 1 ? 9 : 7,
      radius / (label.priority <= 1 ? 29 : label.priority === 2 ? 33 : 38)
    );
    ctx.font = `${label.priority <= 2 ? 700 : 400} ${fontSize}px ${fontFamily}`;
    const width = ctx.measureText(label.name).width + 8;
    const height = fontSize + 5;
    const box = {
      x: label.x - width / 2,
      y: label.y - height / 2,
      width,
      height
    };
    if (occupied.some((item) => boxesOverlap(item, box, label.priority <= 1 ? 1 : 5))) return;
    occupied.push(box);
    drawn += 1;

    const alpha = Math.min(0.88, Math.max(0.25, label.depth));
    if (label.priority <= 2) {
      ctx.globalAlpha = alpha * 0.42;
      ctx.fillStyle = "rgba(0,0,0,0.62)";
      ctx.fillRect(box.x, box.y, box.width, box.height);
    }
    ctx.globalAlpha = alpha;
    ctx.lineWidth = label.priority <= 2 ? 3 : 2;
    ctx.strokeStyle = "rgba(0,0,0,0.76)";
    ctx.strokeText(label.name, label.x, label.y);
    ctx.fillStyle = label.priority <= 2 ? "rgba(247,244,232,0.9)" : "rgba(247,244,232,0.68)";
    ctx.fillText(label.name, label.x, label.y);
  });
  ctx.restore();
}

function drawWorldLand(ctx, cx, cy, radius) {
  const atlasDrawn = drawWorldAtlasCountries(ctx, cx, cy, radius);
  if (atlasDrawn) {
    drawWorldCountryLabels(ctx, cx, cy, radius);
    return;
  }

  WORLD_LANDMASSES.filter((shape) => shape.kind !== "country").forEach((shape) => {
    ctx.beginPath();
    const drew = drawProjectedPolyline(ctx, shape.points, cx, cy, radius, true);
    if (!drew) return;
    const gradient = ctx.createLinearGradient(cx - radius, cy - radius, cx + radius, cy + radius);
    gradient.addColorStop(0, shape.kind === "ice" ? "rgba(235,246,244,0.86)" : "rgba(126,202,108,0.94)");
    gradient.addColorStop(0.48, shape.kind === "ice" ? "rgba(174,218,217,0.76)" : "rgba(54,132,77,0.92)");
    gradient.addColorStop(1, shape.kind === "ice" ? "rgba(74,119,136,0.68)" : "rgba(190,117,65,0.9)");
    ctx.fillStyle = gradient;
    ctx.fill();
    ctx.lineWidth = Math.max(1.1, radius / 190);
    ctx.strokeStyle = "rgba(247,244,232,0.38)";
    ctx.stroke();
  });

  WORLD_LANDMASSES.filter((shape) => shape.kind === "country").forEach((shape) => {
    ctx.beginPath();
    const drew = drawProjectedPolyline(ctx, shape.points, cx, cy, radius, true);
    if (!drew) return;
    ctx.fillStyle = atlasCountryFill(shape);
    ctx.globalAlpha = 0.64;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = Math.max(0.75, radius / 310);
    ctx.strokeStyle = "rgba(247,244,232,0.34)";
    ctx.stroke();
  });

  drawWorldCountryBorderLines(ctx, cx, cy, radius);
  drawWorldCountryLabels(ctx, cx, cy, radius);

  ctx.save();
  ctx.globalAlpha = 0.46;
  ctx.strokeStyle = "rgba(57,245,176,0.22)";
  ctx.lineWidth = Math.max(0.8, radius / 340);
  [
    [[-170, 66], [-128, 60], [-100, 55], [-64, 48]],
    [[-82, 9], [-72, -9], [-65, -25], [-70, -52]],
    [[-10, 35], [24, 32], [43, 13], [32, -31]],
    [[34, 49], [73, 39], [106, 21], [145, 36]],
    [[113, -25], [133, -39], [153, -27]]
  ].forEach((line) => {
    ctx.beginPath();
    if (drawProjectedPolyline(ctx, line, cx, cy, radius)) ctx.stroke();
  });
  ctx.restore();
}

function drawWorldTourRoute(ctx, cx, cy, radius) {
  const band = activeWorldBand();
  const stops = tourStopsForBand(band);
  if (stops.length < 2) return;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "rgba(0,0,0,0.58)";
  ctx.lineWidth = Math.max(4, radius / 88);
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];
    const a = projectCanvasPoint(previous.lon, previous.lat, cx, cy, radius);
    const b = projectCanvasPoint(current.lon, current.lat, cx, cy, radius);
    if (!a.visible || !b.visible) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }

  ctx.strokeStyle = "rgba(225,151,112,0.88)";
  ctx.lineWidth = Math.max(1.4, radius / 250);
  ctx.setLineDash([Math.max(4, radius / 70), Math.max(5, radius / 58)]);
  for (let index = 1; index < stops.length; index += 1) {
    const previous = stops[index - 1];
    const current = stops[index];
    const a = projectCanvasPoint(previous.lon, previous.lat, cx, cy, radius);
    const b = projectCanvasPoint(current.lon, current.lat, cx, cy, radius);
    if (!a.visible || !b.visible) continue;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  }
  ctx.restore();
}

function drawWorldGlobe() {
  const info = resizeWorldCanvas();
  if (!info) return;
  const { canvas, width, height } = info;
  const ctx = canvas.getContext("2d");
  const cx = width / 2;
  const cy = height / 2;
  const radius = Math.min(width, height) * WORLD_GLOBE_RADIUS_RATIO;
  const mapRadius = radius * app.worldZoom;

  ctx.clearRect(0, 0, width, height);
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.clip();

  const ocean = ctx.createRadialGradient(cx - radius * 0.32, cy - radius * 0.34, radius * 0.08, cx, cy, radius);
  ocean.addColorStop(0, "rgba(58,156,144,0.96)");
  ocean.addColorStop(0.38, "rgba(9,58,72,0.98)");
  ocean.addColorStop(0.72, "rgba(3,18,31,1)");
  ocean.addColorStop(1, "rgba(0,5,12,1)");
  ctx.fillStyle = ocean;
  ctx.fillRect(0, 0, width, height);

  drawWorldGraticule(ctx, cx, cy, mapRadius);
  drawWorldLand(ctx, cx, cy, mapRadius);
  drawWorldTourRoute(ctx, cx, cy, mapRadius);

  const glow = ctx.createRadialGradient(cx - radius * 0.24, cy - radius * 0.34, radius * 0.04, cx, cy, radius);
  glow.addColorStop(0, "rgba(247,244,232,0.16)");
  glow.addColorStop(0.48, "rgba(57,245,176,0.05)");
  glow.addColorStop(1, "rgba(0,0,0,0.72)");
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.lineWidth = Math.max(1, radius / 110);
  ctx.strokeStyle = "rgba(151,231,255,0.3)";
  ctx.stroke();

  const atmosphere = ctx.createRadialGradient(cx, cy, radius * 0.88, cx, cy, radius * 1.05);
  atmosphere.addColorStop(0, "rgba(151,231,255,0)");
  atmosphere.addColorStop(0.68, "rgba(151,231,255,0.08)");
  atmosphere.addColorStop(1, "rgba(151,231,255,0.34)");
  ctx.fillStyle = atmosphere;
  ctx.beginPath();
  ctx.arc(cx, cy, radius * 1.03, 0, Math.PI * 2);
  ctx.fill();
}

function updateWorldMarkerPositions() {
  if (!els.worldMarkers) return;
  const buttons = [...els.worldMarkers.querySelectorAll(".world-marker[data-world-band-id]")];
  const labels = [...els.worldMarkers.querySelectorAll(".world-ring-label[data-world-label-band-id]")];
  const focusId = focusedWorldBandId();
  els.worldMarkers.classList.toggle("focused", Boolean(focusId));
  const bands = buttons
    .map((button) => worldBands().find((item) => item.id === button.dataset.worldBandId))
    .filter(Boolean);
  const pointMap = worldBandPointMap(bands);
  const ringSlotMap = worldRingSlotMap(bands, pointMap);
  buttons.forEach((button) => {
    const point = pointMap.get(button.dataset.worldBandId);
    if (!point) return;
    button.style.setProperty("--x", point.x.toFixed(2));
    button.style.setProperty("--y", point.y.toFixed(2));
    button.style.setProperty("--s", point.scale.toFixed(2));
    button.style.setProperty("--depth", point.depth.toFixed(2));
    button.style.setProperty("--z", point.z);
    button.style.display = point.visible ? "" : "none";
    button.classList.toggle("clustered", Number(point.clusterSize || 0) > 1);
    button.classList.toggle("hovered", button.dataset.worldBandId === focusId);
    if (point.clusterSize) button.dataset.clusterCount = String(point.clusterSize);
  });
  labels.forEach((label) => {
    const band = worldBands().find((item) => item.id === label.dataset.worldLabelBandId);
    const point = band ? pointMap.get(band.id) || worldProjection(band) : null;
    if (!band || !point) return;
    const slot = ringSlotMap.get(band.id);
    const labelPoint = worldRingLabelProjection(point, band, slot);
    label.style.setProperty("--label-x", labelPoint.x.toFixed(2));
    label.style.setProperty("--label-y", labelPoint.y.toFixed(2));
    label.style.setProperty("--z", point.z);
    label.style.display = shouldShowWorldRingLabel(band, ringSlotMap) ? "" : "none";
    label.classList.toggle("selected", band.id === app.worldBandId);
    label.classList.toggle("hovered", band.id === app.worldHoverBandId);
    label.classList.toggle("left", labelPoint.anchor === "left");
    label.classList.toggle("right", labelPoint.anchor === "right");
    label.classList.toggle("center", labelPoint.anchor === "center");
  });
}

function renderWorldTourLayer() {
  if (!els.worldTourLayer) return;
  const band = activeWorldBand();
  const stops = tourStopsForBand(band);
  if (!band || !stops.length) {
    els.worldTourLayer.innerHTML = "";
    return;
  }

  const projected = stops
    .map((stop, index) => ({ stop, index, point: tourProjection(stop) }))
    .filter((item) => item.point.visible);
  els.worldTourLayer.innerHTML = projected.map(({ stop, index, point }) => {
    const classes = [
      "world-tour-stop",
      point.x > 72 ? "label-left" : "",
      point.y > 74 ? "label-up" : ""
    ].filter(Boolean).join(" ");
    return `
      <span class="${classes}" title="${escapeAttr(tourStopTitle(stop))}"
        style="--x:${point.x.toFixed(2)}; --y:${point.y.toFixed(2)}; --s:${point.scale.toFixed(2)}; --depth:${point.depth.toFixed(2)}; --z:${point.z};">
        <i></i>
      </span>
    `;
  }).join("");
}

function refreshWorldGlobe() {
  drawWorldGlobe();
  updateWorldMarkerPositions();
  renderWorldTourLayer();
  const profile = rhythmProfile(app.payload?.current);
  const focusBand = activeWorldBand();
  const focusPoint = focusBand ? worldProjection(focusBand) : null;
  const focusScore = focusBand ? bandCatalogTasteMatch(focusBand).score : 0;
  const beat = playbackSeconds() * profile.tempo / 60;
  const pulse = app.playing ? Math.pow(Math.max(0, Math.sin(beat * Math.PI * 2)), 7) : 0;
  els.worldGlobe?.classList.toggle("playing", app.playing);
  els.worldGlobe?.style.setProperty("--world-energy", profile.energy.toFixed(3));
  els.worldGlobe?.style.setProperty("--world-pulse", pulse.toFixed(3));
  els.worldGlobe?.style.setProperty("--world-glow", `${Math.round(16 + profile.energy * 34 + pulse * 20)}px`);
  app.world3D?.update({
    energy: profile.energy,
    beat,
    playing: app.playing,
    centerLon: app.worldCenterLon,
    centerLat: app.worldCenterLat,
    focusX: focusPoint?.x || 50,
    focusY: focusPoint?.y || 50,
    focusVisible: Boolean(focusPoint?.visible),
    focusScore
  });
}

function initWorld3D() {
  if (app.world3D || !window.RadioXWorld3D || !els.world3dCanvas) return;
  try {
    app.world3D = window.RadioXWorld3D;
    app.world3D.mount(els.world3dCanvas);
    refreshWorldGlobe();
  } catch (error) {
    app.world3D = null;
    els.world3dCanvas.hidden = true;
    console.warn("World 3D enhancement unavailable", error);
  }
}

function animateWorldViewTo(lon, lat, zoom = Math.max(1.12, app.worldZoom)) {
  const startLon = app.worldCenterLon;
  app.worldAutoRotate = false;
  app.worldVelocityLon = 0;
  app.worldVelocityLat = 0;
  app.worldFocusAnimation = {
    startedAt: performance.now(),
    duration: 820,
    startLon,
    deltaLon: normalizeDegrees(Number(lon) - startLon),
    startLat: app.worldCenterLat,
    targetLat: clampValue(Number(lat), -62, 62),
    startZoom: app.worldZoom,
    targetZoom: clampValue(zoom, 0.78, app.worldFullscreen ? 4 : 3)
  };
}

function animateWorldGlobe(timestamp = 0) {
  const delta = app.worldLastFrameAt ? Math.min(48, timestamp - app.worldLastFrameAt) : 16;
  app.worldLastFrameAt = timestamp;
  if (!app.worldDragging && app.worldFocusAnimation) {
    const animation = app.worldFocusAnimation;
    const progress = clampValue((timestamp - animation.startedAt) / animation.duration, 0, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    app.worldCenterLon = normalizeDegrees(animation.startLon + animation.deltaLon * eased);
    app.worldCenterLat = animation.startLat + (animation.targetLat - animation.startLat) * eased;
    app.worldZoom = animation.startZoom + (animation.targetZoom - animation.startZoom) * eased;
    if (progress >= 1) app.worldFocusAnimation = null;
  } else if (!app.worldDragging && app.worldAutoRotate) {
    app.worldCenterLon = normalizeDegrees(app.worldCenterLon + app.worldVelocityLon * delta);
    app.worldCenterLat = clampValue(app.worldCenterLat + app.worldVelocityLat * delta, -62, 62);
    app.worldVelocityLon += (0.006 - app.worldVelocityLon) * 0.018;
    app.worldVelocityLat *= 0.94;
  }
  if (app.worldDragging || !app.worldLastDrawAt || timestamp - app.worldLastDrawAt > 30) {
    refreshWorldGlobe();
    app.worldLastDrawAt = timestamp;
  }
  window.requestAnimationFrame(animateWorldGlobe);
}

function focusWorldBand(band) {
  if (!band) return;
  app.worldCenterLon = normalizeDegrees(Number(band.lon || app.worldCenterLon));
  app.worldCenterLat = clampValue(Number(band.lat || 0), -62, 62);
  app.worldVelocityLon = 0;
  app.worldVelocityLat = 0;
}

function albumCoverKey(band, album) {
  return `${band.id}:${album.title}`;
}

function albumCoverInitials(album) {
  return [...String(album?.title || "RX").replace(/^(the|a|an)\s+/i, "").trim()].slice(0, 2).join("").toUpperCase() || "RX";
}

function syncWorldTabs() {
  app.worldFilter = normalizeWorldFilter(localStorage.getItem(WORLD_FILTER_STORAGE_KEY) || app.worldFilter);
  app.worldEra = WORLD_ERAS.has(localStorage.getItem(WORLD_ERA_STORAGE_KEY))
    ? localStorage.getItem(WORLD_ERA_STORAGE_KEY)
    : "all";
  els.worldTabs?.querySelectorAll("[data-world-filter]").forEach((button) => {
    button.classList.toggle("active", normalizeWorldFilter(button.dataset.worldFilter) === app.worldFilter);
  });
  els.worldEra?.querySelectorAll("[data-world-era]").forEach((button) => {
    button.classList.toggle("active", button.dataset.worldEra === app.worldEra);
  });
}

function renderWorldRankStrip(band = activeWorldBand()) {
  if (!els.worldRankStrip) return;
  const entries = worldRankEntriesForBand(band);
  els.worldRankStrip.classList.toggle("focused", Boolean(band));
  els.worldRankStrip.innerHTML = entries.map((entry, index) => {
    const albumKey = worldAlbumKey(entry.band, entry.album);
    const grammy = albumGrammyMeta(entry.band, entry.album);
    const prefix = app.worldFilter === "grammy" && grammy ? "G" : `#${index + 1}`;
    const meta = app.worldFilter === "grammy" && grammy
      ? `${grammy.year} · ${albumTasteMatch(entry.band, entry.album).score}%`
      : `MATCH ${albumTasteMatch(entry.band, entry.album).score}%`;
    return `
      <button class="world-rank-item ${albumKey === app.worldAlbumKey ? "active" : ""}" type="button"
        data-world-band-id="${escapeAttr(entry.band.id)}"
        data-world-album-key="${escapeAttr(albumKey)}">
        <strong>${escapeHtml(prefix)}</strong>
        <span>${escapeHtml(entry.album.title)}</span>
        <em>${escapeHtml(meta)}</em>
      </button>
    `;
  }).join("");
}

function bindWorldMarkerButtons() {
  if (!els.worldMarkers) return;
  els.worldMarkers.querySelectorAll("[data-world-band-id], [data-world-label-band-id]").forEach((button) => {
    const bandId = () => button.dataset.worldBandId || button.dataset.worldLabelBandId || "";
    button.addEventListener("click", (event) => {
      event.stopPropagation();
      const id = bandId();
      selectWorldBand(id);
      showWorldTourTooltip(worldBandById(id), event);
    });
    button.addEventListener("pointerenter", (event) => {
      event.stopPropagation();
      const id = bandId();
      if (app.worldAutoRotate) {
        app.worldHoverPausedRotation = true;
        app.worldAutoRotate = false;
        app.worldVelocityLon = 0;
        app.worldVelocityLat = 0;
      }
      setWorldHoverBand(id);
      showWorldTourTooltip(worldBandById(id), event);
    });
    button.addEventListener("pointermove", (event) => {
      event.stopPropagation();
      positionWorldTourTooltip(event);
    });
    button.addEventListener("pointerleave", (event) => {
      event.stopPropagation();
      const resumeRotation = app.worldHoverPausedRotation;
      app.worldHoverPausedRotation = false;
      setWorldHoverBand("");
      hideWorldTourTooltip();
      if (resumeRotation) {
        window.setTimeout(() => {
          if (!app.worldDragging && !app.worldHoverBandId && !app.worldFocusAnimation && !app.worldCountryLocked) {
            app.worldAutoRotate = true;
            app.worldVelocityLon = 0.006;
          }
        }, 180);
      }
    });
  });
}

function renderWorldAlbumOrbit(band = selectedWorldBand()) {
  if (!els.worldAlbumOrbit) return;
  const entries = band ? worldAlbumsForBand(band).slice(0, 5) : [];
  if (!band || !entries.length) {
    els.worldAlbumOrbit.innerHTML = "";
    return;
  }
  const compactOrbit = window.innerWidth <= 520;
  const radius = compactOrbit
    ? entries.length <= 2 ? 15 : 17
    : entries.length <= 2 ? 21 : 24;
  const nodes = entries.map((entry, index) => {
    const angle = (-88 + index * (360 / entries.length)) * Math.PI / 180;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    const key = worldAlbumKey(band, entry.album);
    const cover = app.worldAlbumCovers.get(albumCoverKey(band, entry.album));
    return `
      <button class="world-album-node ${key === app.worldAlbumKey ? "active" : ""}" type="button"
        data-world-orbit-band-id="${escapeAttr(band.id)}" data-world-orbit-album-index="${entry.albumIndex}"
        title="${escapeAttr(`${entry.album.title} · play ${entry.album.lead || entry.album.title}`)}"
        aria-label="Play ${escapeAttr(entry.album.title)}"
        style="--x:${x.toFixed(2)}; --y:${y.toFixed(2)}; --delay:${(index * -0.38).toFixed(2)}s;">
        ${cover ? `<img src="${escapeAttr(cover)}" alt="">` : `<span>${escapeHtml(albumCoverInitials(entry.album))}</span>`}
      </button>
    `;
  });
  const links = entries.map((entry, index) => {
    const angle = (-88 + index * (360 / entries.length)) * Math.PI / 180;
    const x = 50 + Math.cos(angle) * radius;
    const y = 50 + Math.sin(angle) * radius;
    return `<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" style="--line-delay:${(index * -0.42).toFixed(2)}s"></line>`;
  }).join("");
  els.worldAlbumOrbit.innerHTML = `
    <svg class="world-album-links" viewBox="0 0 100 100" aria-hidden="true" preserveAspectRatio="none">
      ${links}
      <circle cx="50" cy="50" r="1.15"></circle>
    </svg>
    ${nodes.join("")}
  `;
  window.requestAnimationFrame(resolveWorldOverlayCollisions);
}

function resolveWorldOverlayCollisions() {
  if (!els.worldMarkers || !els.worldAlbumOrbit) return;
  const nodes = [...els.worldAlbumOrbit.querySelectorAll(".world-album-node")]
    .map((node) => node.getBoundingClientRect());
  els.worldMarkers.querySelectorAll(".world-ring-label").forEach((label) => {
    label.classList.remove("orbit-collision");
    if (label.classList.contains("selected") || label.style.display === "none") return;
    const box = label.getBoundingClientRect();
    const overlaps = nodes.some((node) => !(
      box.right + 3 < node.left
      || node.right + 3 < box.left
      || box.bottom + 3 < node.top
      || node.bottom + 3 < box.top
    ));
    label.classList.toggle("orbit-collision", overlaps);
  });
}

function renderWorldCountryFocus() {
  if (!els.worldCountryFocus) return;
  const active = Boolean(app.worldCountryName);
  els.worldPanel?.classList.toggle("country-focused", active);
  els.worldCountryFocus.hidden = !active;
  if (!active) return;
  const count = filteredWorldBands().length;
  els.worldCountryName.textContent = app.worldCountryName;
  els.worldCountryMatches.textContent = `${count} TASTE ${count === 1 ? "MATCH" : "MATCHES"}`;
  els.worldCountryFocus.dataset.locked = app.worldCountryLocked ? "true" : "false";
}

function renderWorldBands({ preserveView = false } = {}) {
  if (!els.worldMarkers || !els.bandDetail) return;
  const bands = filteredWorldBands();
  renderWorldCountryFocus();
  if (!bands.length) {
    els.worldMarkers.innerHTML = "";
    if (els.worldAlbumOrbit) els.worldAlbumOrbit.innerHTML = "";
    els.bandDetail.innerHTML = `
      <div>
        <p class="band-detail-kicker">${escapeHtml(app.worldCountryName || worldAlbumFilterLabel())}</p>
        <h3>没有接近的乐队</h3>
        <p>${escapeHtml(app.worldCountryName ? `当前 ${worldAlbumFilterLabel()} 图层中，没有达到 ${WORLD_COUNTRY_TASTE_MIN}% 匹配度的乐队。` : "这个图层暂时没有可显示的专辑。")}</p>
      </div>
    `;
    if (els.worldRankStrip) els.worldRankStrip.innerHTML = "";
    refreshWorldGlobe();
    return;
  }
  const selected = selectedWorldBand();
  if (selected && app.worldBandId !== selected.id) app.worldBandId = selected.id;
  const selectedAlbums = selected ? worldAlbumsForBand(selected) : [];
  if (selectedAlbums.length && !selectedAlbums.some((entry) => worldAlbumKey(selected, entry.album) === app.worldAlbumKey)) {
    app.worldAlbumKey = worldAlbumKey(selected, selectedAlbums[0].album);
  }
  if (app.worldHoverBandId && !worldBandById(app.worldHoverBandId)) app.worldHoverBandId = "";
  if (selected && !preserveView) focusWorldBand(selected);
  const pointMap = worldBandPointMap(bands);
  const focusId = focusedWorldBandId();
  const ringSlotMap = worldRingSlotMap(bands, pointMap);
  els.worldMarkers.classList.toggle("focused", Boolean(focusId));

  const markerHtml = bands.map((band) => {
    const albumCount = worldAlbumsForBand(band).length;
    const match = bandBestTasteMatch(band);
    const catalogMatch = bandCatalogTasteMatch(band);
    const point = pointMap.get(band.id) || worldProjection(band);
    const isSelected = band.id === app.worldBandId;
    const isHovered = band.id === focusId;
    const topRank = band.salesRank && band.salesRank <= 5;
    const classes = [
      "world-marker",
      isSelected ? "selected" : "",
      isHovered ? "hovered" : "",
      topRank ? "sales-top" : "",
      band.taste ? "taste-anchor" : "",
      tasteMatchTier(catalogMatch.score),
      point.clusterSize > 1 ? "clustered" : ""
    ].filter(Boolean).join(" ");
    return `
      <button class="${classes}" type="button" data-world-band-id="${escapeAttr(band.id)}"
        data-cluster-count="${escapeAttr(point.clusterSize || "")}"
        data-taste-match="${catalogMatch.score}"
        title="${escapeAttr(`${band.name} · ${albumCount} albums · match ${match.score}% · ${band.country}`)}"
        style="${point.visible ? "" : "display:none;"} --x:${point.x.toFixed(2)}; --y:${point.y.toFixed(2)}; --s:${point.scale.toFixed(2)}; --depth:${point.depth.toFixed(2)}; --z:${point.z};">
      </button>
    `;
  }).join("");

  const labelHtml = bands.map((band) => {
    const point = pointMap.get(band.id) || worldProjection(band);
    const slot = ringSlotMap.get(band.id);
    const labelPoint = worldRingLabelProjection(point, band, slot);
    const albumCount = worldAlbumsForBand(band).length;
    const match = bandBestTasteMatch(band);
    const grammyYears = worldAlbumsForBand(band)
      .map(({ album }) => albumGrammyMeta(band, album)?.year)
      .filter(Boolean);
    const rank = app.worldFilter === "grammy" ? "G" : band.salesRank ? `#${band.salesRank}` : "T";
    const layerMeta = app.worldFilter === "grammy" && grammyYears.length ? ` · Grammy ${grammyYears.join("/")}` : "";
    const visible = shouldShowWorldRingLabel(band, ringSlotMap);
    const classes = [
      "world-ring-label",
      band.id === app.worldBandId ? "selected" : "",
      band.id === app.worldHoverBandId ? "hovered" : "",
      labelPoint.anchor
    ].filter(Boolean).join(" ");
    return `
      <button class="${classes}" type="button" data-world-label-band-id="${escapeAttr(band.id)}"
        title="${escapeAttr(`${band.name} · ${albumCount} albums · match ${match.score}% · ${band.country}${layerMeta}`)}"
        style="${visible ? "" : "display:none;"} --label-x:${labelPoint.x.toFixed(2)}; --label-y:${labelPoint.y.toFixed(2)}; --z:${point.z};">
        ${escapeHtml(rank)} ${escapeHtml(band.name)}
      </button>
    `;
  }).join("");

  els.worldMarkers.innerHTML = markerHtml + labelHtml;
  bindWorldMarkerButtons();

  const active = activeWorldBand();
  renderWorldRankStrip(active);
  renderBandDetail(active);
  renderWorldAlbumOrbit(selected);
  loadWorldAlbumCovers(active);
  refreshWorldGlobe();
}

function renderBandDetail(band) {
  if (!els.bandDetail || !band) return;
  const albums = worldAlbumsForBand(band);
  const sales = band.claimedSalesM ? `${band.claimedSalesM}M` : "Taste";
  const rank = app.worldFilter === "grammy" ? "GRAMMY" : band.salesRank ? `#${band.salesRank}` : "RadioX";
  const bestMatch = bandBestTasteMatch(band);
  const grammyYears = albums
    .map(({ album }) => albumGrammyMeta(band, album))
    .filter(Boolean)
    .map((grammy) => grammy.year);
  const sortLabel = app.worldFilter === "grammy" ? "GRAMMY YEAR" : "MATCH";
  const sortValue = app.worldFilter === "grammy" && grammyYears.length
    ? [...new Set(grammyYears)].join(", ")
    : `${bestMatch.score}%`;
  els.bandDetail.innerHTML = `
    <div>
      <p class="band-detail-kicker">${escapeHtml(rank)} · ${escapeHtml(worldAlbumFilterLabel())} · ${escapeHtml(band.country)} · ${escapeHtml(band.city)}</p>
      <h3>${escapeHtml(band.name)}</h3>
      <p>${escapeHtml((band.genres || []).join(" / "))}</p>
    </div>
    <div class="band-stats">
      <div class="band-stat">
        <small>SALES</small>
        <strong>${escapeHtml(sales)}</strong>
      </div>
      <div class="band-stat">
        <small>${escapeHtml(sortLabel)}</small>
        <strong>${escapeHtml(sortValue)}</strong>
      </div>
    </div>
    <div class="album-grid">
      ${albums.map((entry) => renderWorldAlbumCard(band, entry.album, entry.albumIndex, entry.note)).join("")}
    </div>
  `;
}

function renderWorldTourPanel(band) {
  const data = worldTourDataForBand(band);
  const stops = tourStopsForBand(band);
  const source = data?.sourceUrl ? `
    <a class="tour-source" href="${escapeAttr(data.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(data.sourceLabel || "source")}</a>
  ` : "";
  if (!stops.length) {
    return `
      <section class="tour-panel">
        <div class="tour-panel-head">
          <small>TOUR MAP</small>
          <strong>${escapeHtml(tourStatusHeading(data, stops))}</strong>
        </div>
        <p class="tour-empty">${escapeHtml(tourStatusCopy(band, data, stops))}</p>
        ${source}
      </section>
    `;
  }

  return `
    <section class="tour-panel">
      <div class="tour-panel-head">
        <small>TOUR MAP</small>
        <strong>${escapeHtml(data?.name || "Recent tour")}</strong>
      </div>
      <div class="tour-list">
        ${stops.slice(0, 9).map((stop) => `
          <div class="tour-row">
            <time>${escapeHtml(tourStopDateLabel(stop))}</time>
            <span>${escapeHtml(tourStopCityLabel(stop))}</span>
            <em>${escapeHtml(stop.venue || "")}</em>
          </div>
        `).join("")}
      </div>
      ${source}
    </section>
  `;
}

function renderWorldAlbumCard(band, album, index, note = "") {
  const cover = app.worldAlbumCovers.get(albumCoverKey(band, album));
  const lead = album.lead || album.tracks?.[0] || album.title;
  const selected = worldAlbumKey(band, album) === app.worldAlbumKey;
  const match = albumTasteMatch(band, album);
  const grammy = albumGrammyMeta(band, album);
  const meta = [
    album.year,
    grammy ? `${grammy.year} Grammy ${grammy.award}` : note || worldAlbumNote(band, album),
    `MATCH ${match.score}%`,
    match.reason,
    `PLAY ${lead}`
  ].filter(Boolean).join(" · ");
  return `
    <button class="album-card ${selected ? "selected" : ""}" type="button" data-world-band-id="${escapeAttr(band.id)}" data-world-album-index="${index}">
      <span class="album-cover">
        ${cover ? `<img src="${escapeAttr(cover)}" alt="${escapeAttr(`${album.title} cover`)}">` : `<span>${escapeHtml(albumCoverInitials(album))}</span>`}
        <em class="album-match">MATCH ${escapeHtml(match.score)}%</em>
      </span>
      <b>${escapeHtml(album.title)}</b>
      <small>${escapeHtml(meta)}</small>
    </button>
  `;
}

function loadWorldAlbumCovers(band) {
  if (!band || !app.spotify?.status().authenticated || typeof app.spotify.resolveTrack !== "function") return;
  worldAlbumsForBand(band).forEach(({ album }) => {
    const key = albumCoverKey(band, album);
    if (app.worldAlbumCovers.has(key) || app.worldAlbumLookup.has(key)) return;
    app.worldAlbumLookup.add(key);
    const lead = album.lead || album.tracks?.[0] || album.title;
    app.spotify.resolveTrack({
      title: lead,
      artist: band.name,
      query: `${lead} ${band.name}`
    }).then((spotifyTrack) => {
      const cover = spotifyAlbumCoverUrl(spotifyTrack);
      if (cover) app.worldAlbumCovers.set(key, cover);
      app.worldAlbumLookup.delete(key);
      if (app.worldBandId === band.id) {
        renderBandDetail(band);
        renderWorldAlbumOrbit(band);
      }
    }).catch((error) => {
      app.worldAlbumLookup.delete(key);
      console.warn("World album cover skipped", error);
    });
  });
}

function worldTrackFromAlbum(band, album) {
  const title = album.lead || album.tracks?.[0] || album.title;
  return {
    id: `world-${stableVoiceHash(`${band.id}:${title}`)}`,
    title,
    artist: band.name,
    query: `${title} ${band.name}`,
    genres: band.genres || ["world-band"],
    moods: ["drive", "focus", "breath"],
    weather: ["clear", "cloudy", "rain"],
    dayParts: ["morning", "workday", "dusk", "night", "deep-night"],
    scheduleTags: ["open"],
    energy: Math.round(Math.min(86, Math.max(34, Number(band.claimedSalesM || 80) / 3))),
    era: band.claimedSalesM ? "world-sales-map" : "taste-map",
    duration: 260,
    story: {
      headline: "World Bands Globe",
      text: `${band.name} 的 ${title} 是从世界乐队地球仪里点进来的歌。RadioX 按国家、销量和你的 taste map 把它接进当前 Queue。`
    }
  };
}

async function playWorldAlbum(albumIndex) {
  const band = selectedWorldBand();
  const album = band?.albums?.[albumIndex];
  if (!band || !album) return;
  const queueKey = albumCoverKey(band, album);
  if (app.worldQueueingKey === queueKey) return;
  app.worldQueueingKey = queueKey;
  setServerState("WORLD");
  try {
    const payload = await api("/api/queue-track", {
      method: "POST",
      body: JSON.stringify({
        play: true,
        track: worldTrackFromAlbum(band, album)
      })
    });
    applyTrackChange(payload, { honorServerPlayState: true, deferVoice: true });
  } catch (error) {
    console.warn(error);
    setServerState("QUEUE ERR");
  } finally {
    app.worldQueueingKey = "";
  }
}

function selectWorldBand(id, albumKey = "") {
  const band = worldBands().find((item) => item.id === id);
  if (!band) return;
  app.worldBandId = band.id;
  app.worldHoverBandId = "";
  app.worldHoverPausedRotation = false;
  const albums = worldAlbumsForBand(band);
  app.worldAlbumKey = albumKey || (albums[0] ? worldAlbumKey(band, albums[0].album) : "");
  animateWorldViewTo(band.lon, band.lat);
  renderWorldBands({ preserveView: true });
}

function setWorldHoverBand(id = "") {
  const nextId = worldBandById(id)?.id || "";
  if (app.worldHoverBandId === nextId) return;
  app.worldHoverBandId = nextId;
  const active = activeWorldBand();
  if (active) {
    renderWorldRankStrip(active);
    renderBandDetail(active);
    loadWorldAlbumCovers(active);
  }
  refreshWorldGlobe();
}

function setWorldFullscreen(fullscreen) {
  app.worldFullscreen = Boolean(fullscreen);
  els.worldPanel?.classList.toggle("fullscreen", app.worldFullscreen);
  document.body.classList.toggle("world-fullscreen-open", app.worldFullscreen);
  if (els.worldFullscreenButton) {
    els.worldFullscreenButton.classList.toggle("active", app.worldFullscreen);
    els.worldFullscreenButton.textContent = app.worldFullscreen ? "EXIT" : "FULL";
  }
  window.setTimeout(refreshWorldGlobe, 60);
  window.setTimeout(refreshWorldGlobe, 240);
  window.setTimeout(resolveWorldOverlayCollisions, 260);
}

function toggleWorldFullscreen() {
  setWorldFullscreen(!app.worldFullscreen);
}

function setWorldCountryFocus(countryName, { locked = false, focusPoint = null } = {}) {
  const nextName = canonicalWorldCountry(countryName);
  if (!nextName) return;
  const countryCenter = WORLD_COUNTRY_LABELS.find((item) => canonicalWorldCountry(item.name) === nextName) || focusPoint;
  const changed = nextName !== app.worldCountryName;
  app.worldCountryName = nextName;
  app.worldCountryLocked = Boolean(locked);
  if (locked && countryCenter) animateWorldViewTo(countryCenter.lon, countryCenter.lat);
  if (!changed) {
    renderWorldCountryFocus();
    refreshWorldGlobe();
    return;
  }
  app.worldHoverBandId = "";
  hideWorldTourTooltip();
  renderWorldBands({ preserveView: true });
}

function clearWorldCountryFocus() {
  app.worldCountryName = "";
  app.worldCountryLocked = false;
  app.worldHoverBandId = "";
  renderWorldBands({ preserveView: true });
}

function handleWorldWheel(event) {
  if (!els.worldGlobe) return;
  event.preventDefault();
  event.stopPropagation();
  app.worldAutoRotate = false;
  hideWorldTourTooltip();
  const previousZoom = app.worldZoom;
  const factor = Math.exp(-event.deltaY * 0.0012);
  app.worldZoom = clampValue(app.worldZoom * factor, 0.78, app.worldFullscreen ? 4 : 3);
  if (Math.abs(app.worldZoom - previousZoom) < 0.002) return;
  app.worldVelocityLon *= 0.72;
  app.worldVelocityLat *= 0.72;
  refreshWorldGlobe();
}

function startWorldDrag(event) {
  if (!els.worldGlobe || event.button > 0) return;
  const target = event.target.closest?.("[data-world-band-id], [data-world-label-band-id], [data-world-orbit-band-id]");
  if (target) return;
  setWorldHoverBand("");
  hideWorldTourTooltip();
  app.worldAutoRotate = false;
  app.worldFocusAnimation = null;
  app.worldDragging = true;
  app.worldDragStart = {
    x: event.clientX,
    y: event.clientY,
    lon: app.worldCenterLon,
    lat: app.worldCenterLat,
    lastX: event.clientX,
    lastY: event.clientY,
    lastAt: performance.now(),
    moved: false
  };
  app.worldVelocityLon = 0;
  app.worldVelocityLat = 0;
  els.worldGlobe.classList.add("dragging");
  els.worldGlobe.setPointerCapture?.(event.pointerId);
}

function moveWorldDrag(event) {
  if (!app.worldDragging || !app.worldDragStart) return;
  event.preventDefault();
  const dx = event.clientX - app.worldDragStart.x;
  const dy = event.clientY - app.worldDragStart.y;
  if (Math.hypot(dx, dy) > 5) {
    app.worldDragStart.moved = true;
    app.worldCountryLocked = false;
  }
  app.worldCenterLon = normalizeDegrees(app.worldDragStart.lon - dx * 0.42);
  app.worldCenterLat = clampValue(app.worldDragStart.lat + dy * 0.32, -62, 62);

  if (app.worldDragStart.moved) {
    const countryName = worldCountryAt(app.worldCenterLon, app.worldCenterLat);
    if (countryName) setWorldCountryFocus(countryName);
  }

  const now = performance.now();
  const elapsed = Math.max(12, now - app.worldDragStart.lastAt);
  app.worldVelocityLon = 0;
  app.worldVelocityLat = 0;
  app.worldDragStart.lastX = event.clientX;
  app.worldDragStart.lastY = event.clientY;
  app.worldDragStart.lastAt = now;
  refreshWorldGlobe();
}

function endWorldDrag(event) {
  if (!app.worldDragging) return;
  const dragStart = app.worldDragStart;
  if (!dragStart?.moved) {
    const point = worldPointFromClient(event.clientX, event.clientY);
    const countryName = point ? worldCountryAt(point.lon, point.lat) : "";
    if (countryName) setWorldCountryFocus(countryName, { locked: true, focusPoint: point });
  }
  app.worldDragging = false;
  app.worldDragStart = null;
  app.worldVelocityLon = 0;
  app.worldVelocityLat = 0;
  els.worldGlobe?.classList.remove("dragging");
  els.worldGlobe?.releasePointerCapture?.(event.pointerId);
}

function renderTasteTags(profile) {
  if (!els.tasteTags || !profile) return;
  els.tasteTags.innerHTML = [...(profile.currentLean || []), ...(profile.tasteAnchors || []).slice(0, 10)]
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
    .join("");
}

function djRecommendationCapsules(message) {
  const text = String(message?.text || "");
  if (!/(推荐|推|听|放|接|队列|播放)/.test(text)) return [];
  const nonTrackTitles = new Set([
    "结果", "列表", "歌单", "播放列表", "队列", "收藏", "推荐", "歌曲", "音乐",
    "result", "list", "playlist", "queue", "spotify", "radiox"
  ]);
  const catalogArtists = new Map();
  (app.payload?.queue || []).forEach((track) => {
    if (track?.title && track?.artist) catalogArtists.set(track.title.toLowerCase(), track.artist);
  });
  worldBands().forEach((band) => {
    (band.albums || []).forEach((album) => {
      [album.lead, ...(album.tracks || [])].filter(Boolean).forEach((title) => {
        catalogArtists.set(String(title).toLowerCase(), band.name);
      });
    });
  });
  const artists = [...new Set([
    ...(app.payload?.profile?.tasteAnchors || []),
    ...(app.payload?.queue || []).map((track) => track.artist),
    ...worldBands().map((band) => band.name)
  ].filter(Boolean))].sort((a, b) => b.length - a.length);
  const seen = new Set();
  return [...text.matchAll(/《([^》]{1,90})》/g)].map((match) => {
    const title = match[1].trim();
    const nearby = text.slice(Math.max(0, match.index - 80), match.index + match[0].length + 80).toLowerCase();
    const artist = catalogArtists.get(title.toLowerCase())
      || artists.find((name) => nearby.includes(String(name).toLowerCase()))
      || "RadioX Request";
    return { title, artist };
  }).filter((item) => {
    if (nonTrackTitles.has(item.title.toLowerCase())) return false;
    const key = `${item.artist}:${item.title}`.toLowerCase();
    if (!item.title || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 4);
}

function renderDjRecommendationCapsules(message) {
  const recommendations = djRecommendationCapsules(message);
  if (!recommendations.length) return "";
  return `
    <div class="dj-recommendations" aria-label="DJ recommendations">
      ${recommendations.map((item) => `
        <button type="button" data-dj-track-title="${escapeAttr(item.title)}" data-dj-track-artist="${escapeAttr(item.artist)}">
          <i aria-hidden="true">▶</i><span>${escapeHtml(item.title)}</span><small>${escapeHtml(item.artist)}</small>
        </button>
      `).join("")}
    </div>
  `;
}

async function queueDjRecommendation(button) {
  const title = button?.dataset.djTrackTitle || "";
  const artist = button?.dataset.djTrackArtist || "RadioX Request";
  if (!title || button.disabled) return;
  button.disabled = true;
  button.classList.add("queueing");
  try {
    const track = {
      id: `dj-${stableVoiceHash(`${artist}:${title}`)}`,
      title,
      artist,
      query: `${title} ${artist}`,
      genres: ["dj-request"],
      moods: [app.payload?.context?.mood || "focus"],
      dayParts: [app.payload?.context?.now?.dayPart || "workday"],
      scheduleTags: ["open"],
      energy: 52,
      duration: 260,
      story: { headline: "DJ 推荐", text: "从 RadioX 对话里直接加入的推荐。" }
    };
    const payload = await api("/api/queue-track", {
      method: "POST",
      body: JSON.stringify({ play: false, track })
    });
    render(payload);
    setServerState("QUEUED");
  } catch (error) {
    console.warn(error);
    button.disabled = false;
    button.classList.remove("queueing");
    setServerState("QUEUE ERR");
  }
}

function renderDjChat(messages) {
  if (!els.djChatLog) return;
  els.djChatLog.innerHTML = (messages || []).map((message) => {
    const role = message.role === "user" ? "user" : "assistant";
    const name = role === "user" ? "YOU" : "RADIOX";
    const thinking = message.thinking === true;
    return `
      <article class="dj-message ${role}${thinking ? " thinking" : ""}">
        <small>${name}</small>
        <p>${thinking ? "<span class=\"thinking-dots\"><i></i><i></i><i></i></span>" : escapeHtml(message.text || "")}</p>
        ${role === "assistant" && !thinking ? renderDjRecommendationCapsules(message) : ""}
      </article>
    `;
  }).join("");
  els.djChatLog.scrollTop = els.djChatLog.scrollHeight;
}

function listToLines(items) {
  return (items || []).join("\n");
}

function parseList(value) {
  return [...new Set(String(value || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean))];
}

function weightsToText(weights) {
  return Object.entries(weights || {})
    .map(([genre, value]) => `${genre}=${value}`)
    .join("\n");
}

function parseWeights(value) {
  return Object.fromEntries(String(value || "")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(.+?)[=:：]\s*(-?\d+(?:\.\d+)?)$/);
      if (!match) return null;
      return [match[1].trim(), Math.round(Number(match[2]))];
    })
    .filter(Boolean));
}

function openTasteSetup() {
  if (!els.tasteSetup) return;
  const profile = app.payload?.profile || {};
  els.tasteStationInput.value = profile.stationName || "RadioX";
  els.tasteNicknameInput.value = profile.nickname || "老朋友";
  els.tasteAnchorsInput.value = listToLines(profile.tasteAnchors);
  els.tasteLeanInput.value = listToLines(profile.currentLean);
  els.tasteNightGenresInput.value = listToLines(profile.timePreferences?.night?.genres || []);
  els.tasteGenreWeightsInput.value = weightsToText(profile.genreWeights);
  if (els.tasteStatus) els.tasteStatus.textContent = "Edit, then save. The queue will retune.";
  els.tasteSetup.hidden = false;
  els.tasteAnchorsInput.focus();
}

function closeTasteSetup() {
  if (els.tasteSetup) els.tasteSetup.hidden = true;
}

async function saveTasteProfile() {
  const profile = app.payload?.profile || {};
  const nightGenres = parseList(els.tasteNightGenresInput.value);
  const body = {
    ...profile,
    stationName: els.tasteStationInput.value.trim() || "RadioX",
    nickname: els.tasteNicknameInput.value.trim() || "老朋友",
    tasteAnchors: parseList(els.tasteAnchorsInput.value),
    currentLean: parseList(els.tasteLeanInput.value),
    genreWeights: parseWeights(els.tasteGenreWeightsInput.value),
    timePreferences: {
      ...(profile.timePreferences || {}),
      night: {
        ...(profile.timePreferences?.night || {}),
        genres: nightGenres,
        boost: profile.timePreferences?.night?.boost ?? 18
      },
      "deep-night": {
        ...(profile.timePreferences?.["deep-night"] || {}),
        genres: nightGenres,
        boost: profile.timePreferences?.["deep-night"]?.boost ?? 22
      }
    }
  };

  if (els.tasteStatus) els.tasteStatus.textContent = "Saving...";
  els.tasteSaveButton.disabled = true;
  try {
    const payload = await api("/api/profile", {
      method: "PUT",
      body: JSON.stringify(body)
    });
    render(payload);
    app.elapsedBeforePlay = 0;
    app.startedAt = Date.now();
    closeTasteSetup();
    setServerState("TASTE SAVED");
  } catch (error) {
    console.warn(error);
    if (els.tasteStatus) els.tasteStatus.textContent = "Save failed. Check the genre=weight lines.";
    setServerState("RETRY");
  } finally {
    els.tasteSaveButton.disabled = false;
  }
}

function hasAny(items, values) {
  const set = new Set((items || []).map(String));
  return values.some((value) => set.has(value));
}

async function sendDjChat(event) {
  event.preventDefault();
  const text = els.djChatInput?.value.trim();
  if (!text) return;

  const existing = app.payload?.state?.djChat || [];
  const optimistic = [
    ...existing,
    { role: "user", text },
    { role: "assistant", text: "...", thinking: true }
  ];
  renderDjChat(optimistic);
  els.djChatInput.value = "";
  els.djChatInput.disabled = true;
  setServerState("DJ THINKING");

  try {
    const response = await api("/api/chat", {
      method: "POST",
      body: JSON.stringify({ text })
    });
    if (response.payload) {
      app.payload = response.payload;
      render(response.payload);
    } else if (app.payload?.state) {
      app.payload.state.djChat = response.messages || [];
      renderDjChat(response.messages || []);
    } else {
      renderDjChat(response.messages || []);
    }
    setServerState("READY");
    speakDjChatReply(response.reply).catch(console.warn);
  } catch (error) {
    console.warn(error);
    renderDjChat([
      ...existing,
      { role: "user", text },
      { role: "assistant", text: "我这边刚才断了一下。你再说一遍，我接着听。" }
    ]);
    setServerState("RETRY");
  } finally {
    els.djChatInput.disabled = false;
    els.djChatInput.focus();
  }
}

function tickClock() {
  const date = new Date();
  els.time.textContent = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
  els.date.textContent = new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    day: "2-digit",
    month: "short",
    year: "numeric"
  }).format(date);
}

function playbackSeconds() {
  if (!app.playing) return app.elapsedBeforePlay;
  return app.elapsedBeforePlay + (Date.now() - app.startedAt) / 1000;
}

function renderProgress() {
  const current = app.payload?.current;
  if (!current) return;
  if (app.scrubbing) return;
  const elapsed = Math.min(playbackSeconds(), current.duration);
  els.elapsed.textContent = formatTime(elapsed);
  els.progress.value = String(Math.round((elapsed / current.duration) * 1000));
  if (elapsed >= current.duration && app.playing) nextTrack();
}

function secondsFromProgress() {
  const duration = app.payload?.current?.duration || 0;
  return Math.round((Number(els.progress.value) / 1000) * duration);
}

function clampSeekSeconds(seconds) {
  const duration = app.payload?.current?.duration || 0;
  return Math.max(0, Math.min(duration, Number(seconds) || 0));
}

function setProgressToSeconds(seconds) {
  const duration = app.payload?.current?.duration || 0;
  const safeSeconds = clampSeekSeconds(seconds);
  els.progress.value = duration ? String(Math.round((safeSeconds / duration) * 1000)) : "0";
  els.elapsed.textContent = formatTime(safeSeconds);
  return safeSeconds;
}

function secondsFromClientX(clientX) {
  const rect = els.progress.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  return Math.round(ratio * (app.payload?.current?.duration || 0));
}

function previewSeekFromProgress() {
  app.scrubbing = true;
  els.elapsed.textContent = formatTime(secondsFromProgress());
}

function previewSeekAtClientX(clientX) {
  app.scrubbing = true;
  setProgressToSeconds(secondsFromClientX(clientX));
}

function commitSeek(seekSeconds) {
  const safeSeconds = setProgressToSeconds(seekSeconds);
  app.elapsedBeforePlay = safeSeconds;
  if (app.playing) app.startedAt = Date.now();
  app.scrubbing = false;

  if (app.spotify?.status().authenticated) {
    const previousText = els.spotifyButton.textContent;
    els.spotifyButton.textContent = "SEEK";
    app.spotify.seek(safeSeconds * 1000)
      .then(() => {
        if (els.spotifyButton.textContent === "SEEK") updateSpotifyButton();
      })
      .catch((error) => {
        console.warn(error);
        els.spotifyButton.textContent = "SEEK ERR";
        window.setTimeout(() => {
          if (els.spotifyButton.textContent === "SEEK ERR") {
            updateSpotifyButton();
            if (!app.spotify?.status().connected && previousText) els.spotifyButton.textContent = previousText;
          }
        }, 1400);
      });
  }
}

function commitSeekFromProgress() {
  const seekSeconds = secondsFromProgress();
  commitSeek(seekSeconds);
}

function handleProgressPointerDown(event) {
  event.preventDefault();
  app.scrubbing = true;
  els.progress.setPointerCapture?.(event.pointerId);
  previewSeekAtClientX(event.clientX);
}

function handleProgressPointerMove(event) {
  if (!app.scrubbing) return;
  event.preventDefault();
  previewSeekAtClientX(event.clientX);
}

function handleProgressPointerUp(event) {
  if (!app.scrubbing) return;
  event.preventDefault();
  const seekSeconds = secondsFromClientX(event.clientX);
  els.progress.releasePointerCapture?.(event.pointerId);
  commitSeek(seekSeconds);
}

function handleProgressClick(event) {
  if (app.scrubbing) return;
  commitSeek(secondsFromClientX(event.clientX));
}

function handleProgressTouchEnd(event) {
  const touch = event.changedTouches?.[0];
  if (!touch) return;
  event.preventDefault();
  commitSeek(secondsFromClientX(touch.clientX));
}

function applyLocalPlayState(playing) {
  const next = Boolean(playing);
  if (next === app.playing) {
    els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
    els.station?.classList.toggle("is-playing", app.playing);
    return false;
  }
  const elapsed = playbackSeconds();
  app.playing = next;
  if (next) {
    app.startedAt = Date.now();
  } else {
    app.elapsedBeforePlay = elapsed;
  }
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
  els.station?.classList.toggle("is-playing", app.playing);
  return true;
}

function setPlaying(playing) {
  if (!applyLocalPlayState(playing)) return;
  api("/api/play-state", {
    method: "POST",
    body: JSON.stringify({
      playing: app.playing,
      volume: Number(els.volume.value),
      spotifyDeviceId: app.spotify?.deviceId || null
    })
  }).catch(console.warn);
}

async function startSimAudio() {
  if (!app.simAudio || !app.payload?.current) return;
  await app.simAudio.start(app.payload.current, Number(els.volume.value));
  app.playbackMode = "sim";
  els.spotifyButton.textContent = "SIM AUDIO";
  els.spotifyButton.classList.add("connected");
}

function stopSimAudio() {
  app.simAudio?.stop();
  if (app.playbackMode === "sim") app.playbackMode = "idle";
  updateSpotifyButton();
}

async function playCurrentOnSpotify(track, options = {}) {
  if (!track || !app.spotify?.status().authenticated) return null;
  const playSeq = ++app.spotifyPlaySeq;
  const targetId = track.id;
  resetSpotifyPlaybackTracking();
  const resumeSeconds = options.positionSeconds ?? (
    app.payload?.current?.id === targetId
      ? playbackSeconds()
      : 0
  );
  setServerState("SPOTIFY");
  els.spotifyButton.textContent = app.spotify?.status().connected ? "TUNING" : "CONNECTING";
  els.spotifyButton.classList.remove("connected");

  const spotifyTrack = await app.spotify.playQuery(track, {
    positionMs: Math.round(Math.max(0, resumeSeconds) * 1000)
  });
  if (playSeq !== app.spotifyPlaySeq || app.payload?.current?.id !== targetId) {
    if (app.payload?.current && app.playing) playCurrentOnSpotify(app.payload.current).catch(console.warn);
    return null;
  }

  app.spotifyTrack = spotifyTrack;
  app.expectedSpotifyUri = spotifyTrack?.uri || "";
  app.spotifyAutoAdvanceUri = "";
  renderAlbumArt(track, spotifyTrack);
  loadAudioFeaturesForSpotifyTrack(track, spotifyTrack).catch(console.warn);
  if (spotifyTrack?.duration_ms) {
    app.payload.current.duration = Math.round(spotifyTrack.duration_ms / 1000);
    els.duration.textContent = formatTime(app.payload.current.duration);
  }
  app.simAudio?.stop();
  app.playbackMode = "spotify";
  app.spotify?.setVolume(Number(els.volume.value) / 100).catch(console.warn);
  els.spotifyButton.textContent = "SPOTIFY";
  els.spotifyButton.classList.add("connected");
  setServerState("READY");
  syncFavoriteStatusFromSpotify(track, { force: true }).catch(console.warn);
  return spotifyTrack;
}

function openSpotifySetup() {
  if (!els.spotifySetup) return;
  els.spotifyClientIdInput.value = app.spotifyConfig?.spotifyClientId || "";
  els.spotifyRedirectUriInput.value = app.spotifyConfig?.spotifyRedirectUri || `${canonicalLoopbackOrigin()}/callback`;
  els.spotifySetup.hidden = false;
  els.spotifyClientIdInput.focus();
}

function closeSpotifySetup() {
  if (els.spotifySetup) els.spotifySetup.hidden = true;
}

function setServerState(text) {
  if (els.serverState) els.serverState.textContent = text;
}

function saveSpotifyClientId() {
  const clientId = els.spotifyClientIdInput.value.trim();
  if (!clientId) return;
  localStorage.setItem(SPOTIFY_CLIENT_ID_KEY, clientId);
  localStorage.removeItem(SPOTIFY_TOKEN_KEY);
  window.location.reload();
}

async function togglePlay() {
  const next = !app.playing;
  await app.simAudio?.unlock().catch(console.warn);
  if (next && app.spotify?.status().authenticated && app.payload?.current) {
    try {
      await playCurrentOnSpotify(app.payload.current);
    } catch (error) {
      console.warn(error);
      app.playbackMode = "idle";
      app.expectedSpotifyUri = "";
      resetSpotifyPlaybackTracking();
      app.spotify?.pause().catch(console.warn);
      if (/token|auth/i.test(error.message)) app.spotify?.clearToken();
      els.spotifyButton.textContent = app.spotify?.status().authenticated ? "CONNECT" : "LOGIN";
      els.spotifyButton.classList.remove("connected");
      setServerState("LOGIN");
      setPlaying(false);
      return;
    }
  } else if (!next && app.playbackMode === "spotify") {
    app.spotifyPlaySeq += 1;
    app.expectedSpotifyUri = "";
    resetSpotifyPlaybackTracking();
    app.spotify.pause().catch(console.warn);
    app.playbackMode = "idle";
    stopSimAudio();
  } else if (next) {
    await startSimAudio();
  } else {
    app.playbackMode = "idle";
    stopSimAudio();
    stopDjVoice();
  }
  setPlaying(next);
  if (!next) stopDjVoice();
}

async function refresh() {
  const payload = await api("/api/now");
  render(payload);
  app.currentAudioFeatures = null;
  app.spotifyPlaySeq += 1;
  app.expectedSpotifyUri = "";
  resetSpotifyPlaybackTracking();
  app.playbackMode = "idle";
  app.elapsedBeforePlay = 0;
  app.startedAt = Date.now();
  if (payload.state?.playing) {
    applyLocalPlayState(true);
    if (app.spotify?.status().authenticated && payload.current) {
      playCurrentOnSpotify(payload.current).catch(console.warn);
    } else {
      startSimAudio().catch(console.warn);
    }
  } else {
    applyLocalPlayState(false);
    api("/api/play-state", {
      method: "POST",
      body: JSON.stringify({ playing: false, volume: Number(els.volume.value) })
    }).catch(console.warn);
  }
}

function applyTrackChange(payload, options = {}) {
  render(payload);
  app.currentAudioFeatures = null;
  app.elapsedBeforePlay = 0;
  app.startedAt = Date.now();
  if (options.honorServerPlayState && !payload.state?.playing) {
    app.spotifyPlaySeq += 1;
    app.expectedSpotifyUri = "";
    resetSpotifyPlaybackTracking();
    app.spotify?.pause().catch(console.warn);
    stopSimAudio();
    stopDjVoice();
    app.playbackMode = "idle";
    applyLocalPlayState(false);
    updateSpotifyButton();
    return;
  }
  if (options.honorServerPlayState && payload.state?.playing) {
    applyLocalPlayState(true);
  }
  if (app.playing && app.spotify?.status().authenticated) {
    playCurrentOnSpotify(payload.current).catch((error) => {
      console.warn(error);
      app.expectedSpotifyUri = "";
      resetSpotifyPlaybackTracking();
      app.spotify?.pause().catch(console.warn);
      setPlaying(false);
      app.playbackMode = "idle";
      updateSpotifyButton();
    });
  } else if (app.playing) {
    startSimAudio().catch(console.warn);
  }
}

async function applyRemotePlayState(playing) {
  const next = Boolean(playing);
  if (next === app.playing) return;
  if (next && app.payload?.current) {
    if (app.spotify?.status().authenticated) {
      await playCurrentOnSpotify(app.payload.current);
    } else {
      await startSimAudio();
    }
    applyLocalPlayState(true);
    return;
  }

  app.spotifyPlaySeq += 1;
  app.expectedSpotifyUri = "";
  resetSpotifyPlaybackTracking();
  if (app.playbackMode === "spotify") app.spotify?.pause().catch(console.warn);
  stopSimAudio();
  stopDjVoice();
  app.playbackMode = "idle";
  applyLocalPlayState(false);
  updateSpotifyButton();
}

async function syncExternalState() {
  if (app.advancing || app.scrubbing || !app.payload) return;
  const payload = await api("/api/snapshot").catch(() => api("/api/now"));
  const currentChanged = payload.current?.id !== app.payload.current?.id;
  const indexChanged = payload.state?.currentIndex !== app.payload.state?.currentIndex;
  const queueOrderChanged = (payload.state?.queueOrder || []).join("|") !== (app.payload.state?.queueOrder || []).join("|");
  const queueChanged = payload.state?.queueSignature !== app.payload.state?.queueSignature || queueOrderChanged;
  const favoriteIdsChanged = (payload.state?.favoriteIds || []).join("|") !== (app.payload.state?.favoriteIds || []).join("|");
  const favoriteRequestChanged = favoriteRequestKey(payload.state?.favoriteRequest) !== favoriteRequestKey(app.payload.state?.favoriteRequest);
  const favoriteChanged = favoriteIdsChanged || favoriteRequestChanged;
  const serverPlaying = Boolean(payload.state?.playing);
  const playStateChanged = serverPlaying !== app.playing;
  if (!currentChanged && !indexChanged && !queueChanged && !playStateChanged && !favoriteChanged) return;
  if (!currentChanged && !indexChanged && !queueChanged) {
    if (favoriteChanged) render(payload);
    if (playStateChanged) {
      await applyRemotePlayState(serverPlaying);
      if (app.payload?.state) app.payload.state.playing = serverPlaying;
    }
    return;
  }
  applyTrackChange(payload, { honorServerPlayState: true, deferVoice: true });
}

async function nextTrack() {
  if (app.advancing) return;
  app.advancing = true;
  try {
    const payload = await api("/api/next", { method: "POST", body: "{}" });
    applyTrackChange(payload, { deferVoice: true });
  } finally {
    app.advancing = false;
  }
}

async function previousTrack() {
  if (app.advancing) return;
  app.advancing = true;
  try {
    const payload = await api("/api/previous", { method: "POST", body: "{}" });
    applyTrackChange(payload, { deferVoice: true });
  } finally {
    app.advancing = false;
  }
}

async function jumpToQueueTrack(index) {
  if (app.advancing) return;
  const queue = app.payload?.queue || [];
  if (!Number.isInteger(index) || index < 0 || index >= queue.length) return;
  app.advancing = true;
  try {
    setServerState("SWITCH");
    const payload = await api("/api/jump", {
      method: "POST",
      body: JSON.stringify({ index, trackId: queue[index]?.id })
    });
    applyTrackChange(payload, { deferVoice: true });
  } finally {
    app.advancing = false;
  }
}

async function reorderQueue(draggedId, targetId) {
  const order = (app.payload?.queue || []).map((track) => track.id);
  const from = order.indexOf(draggedId);
  const to = order.indexOf(targetId);
  if (from < 0 || to < 0 || from === to) return;
  order.splice(from, 1);
  order.splice(to, 0, draggedId);
  setServerState("REORDER");
  try {
    const payload = await api("/api/queue/reorder", {
      method: "POST",
      body: JSON.stringify({ trackIds: order })
    });
    render(payload);
    setServerState("READY");
  } catch (error) {
    console.warn(error);
    render(app.payload);
    setServerState("ORDER ERR");
  }
}

function spotifyTrackId(spotifyTrack) {
  return spotifyTrack?.id || String(spotifyTrack?.uri || "").split(":").pop() || "";
}

function scheduleSpotifyPrefetch() {
  if (!app.spotify?.status().authenticated || !app.payload?.queue?.length) return;
  window.clearTimeout(app.spotifyPrefetchTimer);
  const targets = [app.payload.current, ...app.payload.queue]
    .filter(Boolean)
    .slice(0, 12);
  app.spotifyPrefetchTimer = window.setTimeout(() => {
    app.spotify?.prefetchTracks(targets, 10).catch(console.warn);
  }, 500);
}

async function loadAudioFeaturesForSpotifyTrack(localTrack, spotifyTrack) {
  const id = spotifyTrackId(spotifyTrack);
  if (!localTrack?.id || !id || !app.spotify?.getAudioFeatures) return null;
  if (app.audioFeaturesCache.has(id)) {
    const cached = app.audioFeaturesCache.get(id);
    app.currentAudioFeatures = cached
      ? { ...cached, localTrackId: localTrack.id, spotifyId: id }
      : null;
    return cached || null;
  }

  const features = await app.spotify.getAudioFeatures(id).catch((error) => {
    console.warn(error);
    return null;
  });
  app.audioFeaturesCache.set(id, features || false);
  if (app.payload?.current?.id === localTrack.id) {
    app.currentAudioFeatures = features
      ? { ...features, localTrackId: localTrack.id, spotifyId: id }
      : null;
  }
  return features;
}

function estimatedTempo(track) {
  if (!track) return 88;
  const energy = Number(track.energy || 50);
  let tempo = 78 + energy * 0.46;

  if (hasAny(track.genres, ["metal", "hard-rock", "punk", "grunge", "alternative-rock"])) {
    tempo = 94 + energy * 0.5;
  } else if (hasAny(track.genres, ["classic-rock", "progressive-rock", "mandarin-rock", "j-rock"])) {
    tempo = 84 + energy * 0.42;
  } else if (hasAny(track.genres, ["jazz"])) {
    tempo = 76 + energy * 0.34;
  } else if (hasAny(track.genres, ["blues"])) {
    tempo = 70 + energy * 0.32;
  } else if (hasAny(track.genres, ["classical", "neo-classical"])) {
    tempo = 58 + energy * 0.3;
  }

  return Math.max(56, Math.min(158, tempo));
}

function beatPulse(beat, sharpness = 8) {
  const phase = ((beat % 1) + 1) % 1;
  return Math.exp(-phase * sharpness);
}

function clamp01(value, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.max(0, Math.min(1, number));
}

function rhythmProfile(track) {
  const features = app.currentAudioFeatures?.localTrackId === track?.id
    ? app.currentAudioFeatures
    : null;
  const localEnergy = (track?.energy || 45) / 100;
  const acousticDefault = hasAny(track?.genres, ["classical", "neo-classical"]) ? 0.82
    : hasAny(track?.genres, ["jazz", "blues", "folk-rock"]) ? 0.48
      : 0.2;
  const danceDefault = hasAny(track?.genres, ["jazz", "blues"]) ? 0.42
    : hasAny(track?.genres, ["metal", "hard-rock", "punk", "grunge"]) ? 0.34
      : 0.5;
  const energy = clamp01(features?.energy, localEnergy);
  const danceability = clamp01(features?.danceability, danceDefault);
  const acousticness = clamp01(features?.acousticness, acousticDefault);
  const valence = clamp01(features?.valence, hasAny(track?.moods, ["bright", "drive", "fire"]) ? 0.62 : 0.42);
  const tempo = Math.max(48, Math.min(178, Number(features?.tempo) || estimatedTempo(track)));
  const density = hasAny(track?.genres, ["metal", "hard-rock", "punk", "grunge"]) ? 1.24
    : hasAny(track?.genres, ["jazz", "blues"]) ? 0.76
      : hasAny(track?.genres, ["classical", "neo-classical"]) ? 0.46
        : 0.92;

  return {
    tempo,
    energy,
    danceability,
    acousticness,
    valence,
    density: density + danceability * 0.22 - acousticness * 0.12,
    swing: hasAny(track?.genres, ["jazz", "blues"]) ? 0.18 : danceability * 0.08,
    source: features ? "spotify" : "local"
  };
}

function drawSpectrum() {
  const canvas = els.spectrum;
  const ctx = canvas.getContext("2d");
  const dpr = window.devicePixelRatio || 1;
  if (canvas.dataset.dpr !== String(dpr)) {
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    canvas.dataset.dpr = String(dpr);
  }
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const bars = Math.max(42, Math.floor(w / (8 * dpr)));
  const gap = 4 * dpr;
  const barWidth = Math.max(2 * dpr, (w - gap * bars) / bars);
  const current = app.payload?.current;
  const profile = rhythmProfile(current);
  const elapsed = current ? playbackSeconds() : 0;
  const beat = elapsed * profile.tempo / 60;
  const barCycle = Math.max(0.42, profile.density);

  for (let i = 0; i < bars; i += 1) {
    const laneBeat = beat - i * 0.016 * barCycle + Math.sin(i * 0.11) * profile.swing;
    const kick = app.playing ? beatPulse(laneBeat, 8 + profile.energy * 8) : 0.14;
    const backbeat = app.playing ? beatPulse(laneBeat - 0.5, 11 + profile.danceability * 5) * (0.16 + profile.danceability * 0.34) : 0;
    const syncopation = app.playing
      ? beatPulse(laneBeat - (profile.swing ? 0.68 : 0.75), 13) * profile.danceability * 0.18
      : 0;
    const phrase = 0.6 + Math.sin(elapsed * 0.18 + i * 0.035) * 0.24;
    const wave = Math.sin(i * (0.24 + profile.danceability * 0.08) + beat * (0.42 + profile.energy * 0.34)) * 0.38
      + Math.sin(i * 0.12 - beat * (0.82 + profile.density * 0.18)) * (0.22 + profile.valence * 0.14);
    const acousticLift = profile.acousticness * Math.abs(Math.sin(i * 0.17 + elapsed * 0.42)) * 0.18;
    const normalized = Math.max(
      0.08,
      Math.abs(wave) * 0.3
        + profile.energy * 0.17
        + kick * (0.34 + profile.energy * 0.32)
        + backbeat
        + syncopation
        + acousticLift
    );
    const barHeight = normalized * phrase * h * (profile.source === "spotify" ? 0.82 : 0.76);
    const x = i * (barWidth + gap);
    const y = h - barHeight - 6 * dpr;
    const gradient = ctx.createLinearGradient(0, y, 0, h);
    gradient.addColorStop(0, "rgba(247,244,232,0.95)");
    gradient.addColorStop(1, "rgba(57,245,176,0.4)");
    ctx.fillStyle = gradient;
    ctx.fillRect(x, y, barWidth, barHeight);
  }
  requestAnimationFrame(drawSpectrum);
}

function spotifyDurationSeconds(spotifyState) {
  const fromSpotify = Number(spotifyState?.duration) / 1000;
  if (Number.isFinite(fromSpotify) && fromSpotify > 0) return fromSpotify;
  return Number(app.payload?.current?.duration || 0);
}

function requestSpotifyAutoAdvance(actualUri, reason) {
  if (!actualUri || app.spotifyAutoAdvanceUri === actualUri || app.advancing) return false;
  app.spotifyAutoAdvanceUri = actualUri;
  setServerState(reason === "loop" ? "NEXT" : "ENDED");
  nextTrack().catch((error) => {
    console.warn(error);
    app.spotifyAutoAdvanceUri = "";
    setServerState("RETRY");
  });
  return true;
}

function maybeAutoAdvanceSpotify(spotifyState, actualUri, positionSeconds, durationSeconds) {
  if (
    app.playbackMode !== "spotify"
    || !app.playing
    || !app.expectedSpotifyUri
    || actualUri !== app.expectedSpotifyUri
    || durationSeconds <= 0
  ) {
    return false;
  }

  const previous = app.spotifyState || {};
  const previousPosition = Number(previous.positionSeconds || 0);
  const previousUri = previous.uri || "";
  const endWindow = Math.max(2.5, Math.min(6, durationSeconds * 0.015));
  const nearEnd = positionSeconds >= durationSeconds - 1.4;
  const wasNearEnd = previousUri === actualUri && previousPosition >= durationSeconds - endWindow;
  const localWasNearEnd = playbackSeconds() >= durationSeconds - endWindow;
  const returnedToStart = positionSeconds <= 2.5 && (wasNearEnd || localWasNearEnd);
  const loopedToStart = returnedToStart && !spotifyState.paused;
  const pausedAfterEnd = spotifyState.paused && (nearEnd || returnedToStart);

  if (loopedToStart || pausedAfterEnd) {
    return requestSpotifyAutoAdvance(actualUri, loopedToStart ? "loop" : "ended");
  }
  return false;
}

function syncSpotifyPlaybackState(spotifyState, actualUri) {
  if (
    app.playbackMode !== "spotify"
    || !spotifyState
    || !app.expectedSpotifyUri
    || actualUri !== app.expectedSpotifyUri
  ) {
    return;
  }

  const positionSeconds = Number(spotifyState.position) / 1000;
  if (!Number.isFinite(positionSeconds)) return;
  const durationSeconds = spotifyDurationSeconds(spotifyState);
  const autoAdvancing = maybeAutoAdvanceSpotify(spotifyState, actualUri, positionSeconds, durationSeconds);
  app.spotifyState = {
    uri: actualUri,
    positionSeconds,
    durationSeconds,
    updatedAt: Date.now(),
    paused: Boolean(spotifyState.paused)
  };
  app.elapsedBeforePlay = positionSeconds;
  app.startedAt = Date.now();
  return autoAdvancing;
}

function applySpotifyPlayerState(spotifyState) {
  const spotifyTrack = spotifyState?.track_window?.current_track;
  const actualUri = spotifyTrack?.uri;
  if (!spotifyTrackMatchesCurrent(spotifyTrack, app.payload?.current)) return false;

  app.playbackMode = "spotify";
  app.expectedSpotifyUri = actualUri || app.expectedSpotifyUri;
  app.spotifyTrack = spotifyTrack;
  renderAlbumArt(app.payload?.current, spotifyTrack);
  loadAudioFeaturesForSpotifyTrack(app.payload?.current, spotifyTrack).catch(console.warn);
  syncFavoriteStatusFromSpotify(app.payload?.current).catch(console.warn);
  const autoAdvancing = syncSpotifyPlaybackState(spotifyState, actualUri || app.expectedSpotifyUri);
  if (autoAdvancing) return true;
  app.playing = !spotifyState.paused;
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
  els.station?.classList.toggle("is-playing", app.playing);
  renderProgress();
  updateSpotifyButton();
  return true;
}

function spotifyPlaybackToPlayerState(playback) {
  const track = playback?.item?.type === "track" ? playback.item : null;
  if (!track) return null;
  return {
    paused: !playback.is_playing,
    position: Number(playback.progress_ms) || 0,
    track_window: {
      current_track: track
    }
  };
}

async function syncSpotifyProgressFromPlayer() {
  const status = app.spotify?.status();
  if (!status?.authenticated || !app.payload?.current) return false;

  if (status.connected) {
    const state = await app.spotify.getCurrentState?.().catch((error) => {
      console.warn(error);
      return null;
    });
    if (state && applySpotifyPlayerState(state)) return true;
  }

  const playback = await app.spotify.getPlaybackState?.().catch((error) => {
    console.warn(error);
    if (/token|auth|expired|401/i.test(error.message || "")) {
      app.spotify?.clearToken();
      updateSpotifyButton();
    }
    return null;
  });
  const remoteState = spotifyPlaybackToPlayerState(playback);
  if (!remoteState) return false;
  return applySpotifyPlayerState(remoteState);
}

async function initSpotify() {
  const serverConfig = await api("/api/config");
  app.serviceConfig = serverConfig;
  if (!window.isSecureContext && serverConfig.httpsAvailable) {
    setSystemIssue("Mobile", `HTTPS required for Spotify/PWA: ${serverConfig.secureOrigin}`);
  } else {
    setSystemIssue("Mobile", "");
  }
  const savedClientId = localStorage.getItem(SPOTIFY_CLIENT_ID_KEY);
  const config = {
    ...serverConfig,
    spotifyClientId: savedClientId || serverConfig.spotifyClientId,
    spotifyRedirectUri: serverConfig.spotifyRedirectUri || `${canonicalLoopbackOrigin()}/callback`
  };
  app.spotifyConfig = config;
  if (els.spotifyRedirectUriInput) els.spotifyRedirectUriInput.value = config.spotifyRedirectUri;
  if (els.spotifyClientIdInput) els.spotifyClientIdInput.value = config.spotifyClientId || "";
  app.spotify = new SpotifyBridge();
  await app.spotify.init(config).catch((error) => {
    const message = error.message || "init failed";
    const needsLogin = /not authenticated/i.test(message);
    if (!needsLogin) console.warn(error);
    setSystemIssue("Spotify", needsLogin ? "" : message);
    setServerState(needsLogin ? "READY" : /spotify/i.test(message) ? "LOGIN ERR" : "READY");
    return app.spotify.status();
  });
  renderSystemStatus();
  updateSpotifyButton();
  app.spotifyLibrarySyncDisabled = false;
  const shouldAutoConnect = app.spotify?.justAuthenticated;
  app.spotify.addEventListener("ready", () => {
    setSystemIssue("Spotify", "");
    app.playbackMode = app.playbackMode === "spotify" ? "spotify" : app.playbackMode;
    updateSpotifyButton();
    renderSystemStatus();
    loadWorldAlbumCovers(selectedWorldBand());
    syncSpotifyProgressFromPlayer().catch(console.warn);
    syncFavoriteStatusFromSpotify(app.payload?.current, { force: true }).catch(console.warn);
    api("/api/play-state", {
      method: "POST",
      body: JSON.stringify({ playing: app.playing, spotifyDeviceId: app.spotify.deviceId })
    }).catch(console.warn);
  });
  app.spotify.addEventListener("playerstate", (event) => {
    const spotifyState = event.detail?.state;
    const actualUri = event.detail?.currentTrack?.uri;
    syncSpotifyPlaybackState(spotifyState, actualUri);
    if (!app.playing || app.playbackMode !== "spotify" || !app.expectedSpotifyUri || !actualUri) return;
    if (actualUri === app.expectedSpotifyUri) return;
    window.clearTimeout(app.spotifyMismatchTimer);
    app.spotifyMismatchTimer = window.setTimeout(() => {
      if (app.playing && app.playbackMode === "spotify" && app.payload?.current) {
        playCurrentOnSpotify(app.payload.current).catch(console.warn);
      }
    }, 500);
  });
  app.spotify.addEventListener("error", (event) => {
    if (/token|auth/i.test(event.detail?.message || "")) app.spotify?.clearToken();
    setSystemIssue("Spotify", event.detail?.message || "Spotify player error");
    els.spotifyButton.textContent = app.spotify?.configured()
      ? (app.spotify?.status().authenticated ? "CONNECT" : "LOGIN")
      : "SET SPOTIFY";
    els.spotifyButton.classList.remove("connected");
    if (app.playbackMode === "spotify") {
      app.playbackMode = "idle";
      setPlaying(false);
    }
    console.warn(event.detail.message);
    renderSystemStatus();
  });
  if (shouldAutoConnect) {
    setServerState("LOGIN OK");
    connectSpotify().catch(console.warn);
  }
}

async function connectSpotify() {
  try {
    setServerState("CONNECT");
    els.spotifyButton.textContent = "CONNECTING";
    els.spotifyButton.classList.remove("connected");
    await app.spotify.loadPlayer();
    updateSpotifyButton();
    setServerState("READY");
    return true;
  } catch (error) {
    console.warn(error);
    app.spotify?.resetPlayer();
    if (/token|auth|expired|401/i.test(error.message)) app.spotify?.clearToken();
    updateSpotifyButton();
    if (!app.spotify?.status().authenticated) els.spotifyButton.textContent = "LOGIN";
    else els.spotifyButton.textContent = "CONNECT";
    setServerState("RETRY");
    return false;
  }
}

function updateSpotifyButton() {
  const status = app.spotify?.status();
  if (!status?.configured) {
    els.spotifyButton.textContent = "SET SPOTIFY";
    els.spotifyButton.classList.remove("connected");
    els.spotifyButton.classList.add("needs-setup");
    return;
  }
  els.spotifyButton.classList.remove("needs-setup");
  if (status.connected) {
    els.spotifyButton.textContent = "SPOTIFY";
    els.spotifyButton.classList.add("connected");
    return;
  }
  if (status.authenticated) {
    els.spotifyButton.textContent = "CONNECT";
    els.spotifyButton.classList.remove("connected");
    return;
  }
  els.spotifyButton.textContent = status.needsLogin ? "RE-LOGIN" : "LOGIN";
  els.spotifyButton.classList.remove("connected");
}

function syncForegroundPlayback() {
  syncExternalState()
    .catch(console.warn)
    .finally(() => {
      syncSpotifyProgressFromPlayer().catch(console.warn);
      syncFavoriteStatusFromSpotify(app.payload?.current).catch(console.warn);
      window.setTimeout(() => syncSpotifyProgressFromPlayer().catch(console.warn), 550);
    });
}

function bindEvents() {
  els.playButton.addEventListener("click", togglePlay);
  els.nextButton.addEventListener("click", nextTrack);
  els.prevButton.addEventListener("click", previousTrack);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      document.title = APP_TITLE;
      syncForegroundPlayback();
    }
  });
  window.addEventListener("focus", syncForegroundPlayback);
  window.addEventListener("pageshow", syncForegroundPlayback);
  els.queue.addEventListener("dblclick", (event) => {
    const item = event.target.closest("li[data-queue-index]");
    if (!item) return;
    jumpToQueueTrack(Number(item.dataset.queueIndex));
  });
  els.queue.addEventListener("dragstart", (event) => {
    const item = event.target.closest("li[data-queue-track-id]");
    if (!item) return;
    app.queueDragTrackId = item.dataset.queueTrackId;
    item.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", app.queueDragTrackId);
  });
  els.queue.addEventListener("dragover", (event) => {
    const item = event.target.closest("li[data-queue-track-id]");
    if (!item || item.dataset.queueTrackId === app.queueDragTrackId) return;
    event.preventDefault();
    els.queue.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    item.classList.add("drop-target");
  });
  els.queue.addEventListener("drop", (event) => {
    const item = event.target.closest("li[data-queue-track-id]");
    event.preventDefault();
    if (item && app.queueDragTrackId) reorderQueue(app.queueDragTrackId, item.dataset.queueTrackId);
    app.queueDragTrackId = "";
  });
  els.queue.addEventListener("dragend", () => {
    app.queueDragTrackId = "";
    els.queue.querySelectorAll(".dragging, .drop-target").forEach((node) => node.classList.remove("dragging", "drop-target"));
  });
  els.queue.addEventListener("pointerdown", (event) => {
    const grip = event.target.closest(".queue-grip");
    const item = grip?.closest("li[data-queue-track-id]");
    if (!item || event.button > 0) return;
    app.queuePointerDrag = {
      pointerId: event.pointerId,
      trackId: item.dataset.queueTrackId,
      startX: event.clientX,
      startY: event.clientY,
      active: false
    };
    grip.setPointerCapture?.(event.pointerId);
  });
  els.queue.addEventListener("pointermove", (event) => {
    const drag = app.queuePointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (!drag.active && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
    drag.active = true;
    event.preventDefault();
    els.queue.querySelector(`[data-queue-track-id="${CSS.escape(drag.trackId)}"]`)?.classList.add("dragging");
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("li[data-queue-track-id]");
    els.queue.querySelectorAll(".drop-target").forEach((node) => node.classList.remove("drop-target"));
    if (target && target.dataset.queueTrackId !== drag.trackId) target.classList.add("drop-target");
  });
  const finishQueuePointerDrag = (event) => {
    const drag = app.queuePointerDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest("li[data-queue-track-id]");
    app.queuePointerDrag = null;
    els.queue.querySelectorAll(".dragging, .drop-target").forEach((node) => node.classList.remove("dragging", "drop-target"));
    if (drag.active && target && target.dataset.queueTrackId !== drag.trackId) {
      event.preventDefault();
      reorderQueue(drag.trackId, target.dataset.queueTrackId);
    }
  };
  els.queue.addEventListener("pointerup", finishQueuePointerDrag);
  els.queue.addEventListener("pointercancel", finishQueuePointerDrag);
  els.worldGlobe?.addEventListener("pointerdown", startWorldDrag);
  els.worldGlobe?.addEventListener("pointermove", moveWorldDrag);
  els.worldGlobe?.addEventListener("pointerup", endWorldDrag);
  els.worldGlobe?.addEventListener("pointercancel", endWorldDrag);
  els.worldGlobe?.addEventListener("wheel", handleWorldWheel, { passive: false });
  els.worldGlobe?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    toggleWorldFullscreen();
  });
  els.worldFullscreenButton?.addEventListener("click", toggleWorldFullscreen);
  els.worldCountryClear?.addEventListener("click", clearWorldCountryFocus);
  window.addEventListener("resize", () => {
    refreshWorldGlobe();
    window.requestAnimationFrame(resolveWorldOverlayCollisions);
  });
  els.worldMarkers?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-world-band-id]");
    if (!item) return;
    selectWorldBand(item.dataset.worldBandId);
    showWorldTourTooltip(worldBandById(item.dataset.worldBandId), event);
  });
  els.worldMarkers?.addEventListener("pointerover", (event) => {
    const item = event.target.closest("[data-world-band-id]");
    if (!item) return;
    setWorldHoverBand(item.dataset.worldBandId);
    showWorldTourTooltip(worldBandById(item.dataset.worldBandId), event);
  });
  els.worldMarkers?.addEventListener("pointermove", (event) => {
    const item = event.target.closest("[data-world-band-id]");
    if (!item) return;
    positionWorldTourTooltip(event);
  });
  els.worldMarkers?.addEventListener("pointerleave", () => {
    setWorldHoverBand("");
    hideWorldTourTooltip();
  });
  els.worldAlbumOrbit?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-world-orbit-band-id]");
    if (!item) return;
    const albumIndex = Number(item.dataset.worldOrbitAlbumIndex);
    selectWorldBand(item.dataset.worldOrbitBandId);
    playWorldAlbum(albumIndex).catch(console.warn);
  });
  els.worldRankStrip?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-world-band-id]");
    if (!item) return;
    selectWorldBand(item.dataset.worldBandId, item.dataset.worldAlbumKey || "");
  });
  els.worldTabs?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-world-filter]");
    if (!item) return;
    app.worldFilter = normalizeWorldFilter(item.dataset.worldFilter || "million");
    app.worldHoverBandId = "";
    hideWorldTourTooltip();
    localStorage.setItem(WORLD_FILTER_STORAGE_KEY, app.worldFilter);
    els.worldTabs.querySelectorAll("[data-world-filter]").forEach((button) => {
      button.classList.toggle("active", button === item);
    });
    const currentBand = worldBandById(app.worldBandId);
    const nextBand = currentBand || filteredWorldBands()[0] || null;
    app.worldBandId = nextBand?.id || "";
    const nextAlbum = nextBand ? worldAlbumsForBand(nextBand)[0]?.album : null;
    app.worldAlbumKey = nextAlbum ? worldAlbumKey(nextBand, nextAlbum) : "";
    renderWorldBands();
  });
  els.worldEra?.addEventListener("click", (event) => {
    const item = event.target.closest("[data-world-era]");
    if (!item || !WORLD_ERAS.has(item.dataset.worldEra)) return;
    app.worldEra = item.dataset.worldEra;
    localStorage.setItem(WORLD_ERA_STORAGE_KEY, app.worldEra);
    els.worldEra.querySelectorAll("[data-world-era]").forEach((button) => {
      button.classList.toggle("active", button === item);
    });
    app.worldHoverBandId = "";
    const nextBand = filteredWorldBands()[0] || null;
    app.worldBandId = nextBand?.id || "";
    const nextAlbum = nextBand ? worldAlbumsForBand(nextBand)[0]?.album : null;
    app.worldAlbumKey = nextAlbum ? worldAlbumKey(nextBand, nextAlbum) : "";
    renderWorldBands();
  });
  els.bandDetail?.addEventListener("click", (event) => {
    const albumButton = event.target.closest("[data-world-album-index]");
    if (!albumButton) return;
    const band = worldBands().find((item) => item.id === albumButton.dataset.worldBandId) || selectedWorldBand();
    const album = band?.albums?.[Number(albumButton.dataset.worldAlbumIndex)];
    if (band && album) app.worldAlbumKey = worldAlbumKey(band, album);
    if (band) app.worldBandId = band.id;
    playWorldAlbum(Number(albumButton.dataset.worldAlbumIndex)).catch(console.warn);
  });
  els.favButton.addEventListener("click", async () => {
    const track = app.payload?.current;
    const id = track?.id;
    if (!id) return;
    const nextFavorite = !app.favorites.has(id);
    setLocalFavorite(id, nextFavorite);
    try {
      const payload = await api("/api/favorite", {
        method: "POST",
        body: JSON.stringify({ trackId: id, favorite: nextFavorite, source: "pwa", silent: true })
      });
      render(payload);
    } catch (error) {
      console.warn(error);
      setLocalFavorite(id, !nextFavorite);
      return;
    }
    await syncFavoriteToSpotify(track, nextFavorite);
  });
  els.voiceButton?.addEventListener("click", () => {
    setVoiceEnabled(!app.voiceEnabled);
    if (!app.voiceEnabled) stopDjVoice();
  });
  window.speechSynthesis?.addEventListener?.("voiceschanged", updateVoiceButton);
  els.volume.addEventListener("input", () => {
    app.simAudio?.setVolume(Number(els.volume.value));
    app.spotify?.setVolume(Number(els.volume.value) / 100).catch(console.warn);
    api("/api/play-state", {
      method: "POST",
      body: JSON.stringify({ playing: app.playing, volume: Number(els.volume.value) })
    }).catch(console.warn);
  });
  els.progress.addEventListener("pointerdown", handleProgressPointerDown);
  els.progress.addEventListener("pointermove", handleProgressPointerMove);
  els.progress.addEventListener("pointerup", handleProgressPointerUp);
  els.progress.addEventListener("pointercancel", () => {
    app.scrubbing = false;
  });
  els.progress.addEventListener("click", handleProgressClick);
  els.progress.addEventListener("touchend", handleProgressTouchEnd, { passive: false });
  els.progress.addEventListener("input", previewSeekFromProgress);
  els.progress.addEventListener("change", commitSeekFromProgress);
  els.progress.addEventListener("keyup", (event) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End", "PageUp", "PageDown"].includes(event.key)) {
      commitSeekFromProgress();
    }
  });
  els.spotifyButton.addEventListener("click", async () => {
    if (!app.spotify?.configured()) {
      openSpotifySetup();
      return;
    }
    const status = app.spotify.status();
    if (!status.authenticated) {
      if (status.needsLogin) app.spotify.clearToken();
      await app.spotify.login();
      return;
    }
    await connectSpotify();
  });
  els.spotifySetupClose?.addEventListener("click", closeSpotifySetup);
  els.spotifySaveButton?.addEventListener("click", saveSpotifyClientId);
  els.tasteEditButton?.addEventListener("click", openTasteSetup);
  els.tasteSetupClose?.addEventListener("click", closeTasteSetup);
  els.tasteSaveButton?.addEventListener("click", () => {
    saveTasteProfile().catch(console.warn);
  });
  els.djChatForm?.addEventListener("submit", sendDjChat);
  els.djChatLog?.addEventListener("click", (event) => {
    const recommendation = event.target.closest("[data-dj-track-title]");
    if (recommendation) queueDjRecommendation(recommendation);
  });
  els.spotifyLoginButton?.addEventListener("click", async () => {
    const clientId = els.spotifyClientIdInput.value.trim();
    if (clientId && clientId !== localStorage.getItem(SPOTIFY_CLIENT_ID_KEY)) {
      localStorage.setItem(SPOTIFY_CLIENT_ID_KEY, clientId);
      app.spotifyConfig = {
        ...app.spotifyConfig,
        spotifyClientId: clientId
      };
      app.spotify = new SpotifyBridge();
      await app.spotify.init(app.spotifyConfig);
    }
    if (app.spotify?.configured()) {
      app.spotify.clearToken();
      await app.spotify.login();
    }
  });
  els.spotifySetup?.addEventListener("click", (event) => {
    if (event.target === els.spotifySetup) closeSpotifySetup();
  });
  els.tasteSetup?.addEventListener("click", (event) => {
    if (event.target === els.tasteSetup) closeTasteSetup();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (app.worldFullscreen) setWorldFullscreen(false);
      closeSpotifySetup();
      closeTasteSetup();
    }
  });
}

window.addEventListener("radiox:world3d-ready", initWorld3D);

async function main() {
  if (canonicalizeLoopbackOrigin()) return;
  consumeTransferredSpotifyClientId();
  app.simAudio = new SimAudio();
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(console.warn);
  }
  tickClock();
  setInterval(tickClock, 1000);
  setInterval(renderProgress, 250);
  setInterval(() => syncExternalState().catch(console.warn), 2000);
  setInterval(() => syncFavoriteStatusFromSpotify(app.payload?.current).catch(console.warn), 15000);
  bindEvents();
  initWorld3D();
  syncWorldTabs();
  await initSpotify();
  await refresh();
  await refreshWeatherStatus();
  await loadWorldCatalogFromApi();
  renderWorldBands();
  loadWorldAtlas().catch(console.warn);
  scheduleSpotifyPrefetch();
  await syncSpotifyProgressFromPlayer().catch(console.warn);
  await syncFavoriteStatusFromSpotify(app.payload?.current, { force: true }).catch(console.warn);
  drawSpectrum();
  window.requestAnimationFrame(animateWorldGlobe);
  setServerState("READY");
}

main().catch((error) => {
  els.serverState.textContent = "ERROR";
  console.error(error);
});
