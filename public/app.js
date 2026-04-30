const els = {
  time: document.querySelector("#time"),
  date: document.querySelector("#date"),
  heroLine: document.querySelector("#heroLine"),
  trackTitle: document.querySelector("#trackTitle"),
  trackArtist: document.querySelector("#trackArtist"),
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
  transcript: document.querySelector("#transcript"),
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
  spectrum: document.querySelector("#spectrum"),
  restCue: document.querySelector("#restCue"),
  restCueToggle: document.querySelector("#restCueToggle"),
  restCueMini: document.querySelector("#restCueMini"),
  restCueState: document.querySelector("#restCueState"),
  restCueText: document.querySelector("#restCueText"),
  restCueTrack: document.querySelector("#restCueTrack"),
  restCueArtist: document.querySelector("#restCueArtist"),
  restCueNotify: document.querySelector("#restCueNotify"),
  restCueLater: document.querySelector("#restCueLater"),
  restCueAccept: document.querySelector("#restCueAccept")
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
  lastSpokenKey: "",
  advancing: false,
  spotifyPlaySeq: 0,
  expectedSpotifyUri: "",
  spotifyMismatchTimer: null,
  spotifyPrefetchTimer: null,
  spotifyAutoAdvanceUri: "",
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
  restCue: {
    expanded: false,
    sessionStartedAt: Date.now(),
    lastActivityAt: Date.now(),
    dismissedUntil: Number(localStorage.getItem("radiox.restCueDismissedUntil") || 0),
    recommendation: null,
    notifyEnabled: localStorage.getItem("radiox.restCueNotify") === "on",
    lastNotificationKey: ""
  },
  favorites: new Set(JSON.parse(localStorage.getItem("radiox.favorites") || "[]"))
};

const SPOTIFY_CLIENT_ID_KEY = "radiox.spotify.clientId";
const SPOTIFY_TOKEN_KEY = "radiox.spotify.token";
const DJ_VOICE_KEY = "radiox.djVoice";
const REST_CUE_NOTIFY_KEY = "radiox.restCueNotify";
const FAVORITE_REQUEST_KEY = "radiox.favoriteRequestKey";
const APP_TITLE = "RadioX";
const REST_CUE_DISMISS_MS = 25 * 60 * 1000;
const REST_CUE_BUSY_MS = 18 * 60 * 1000;
const REST_CUE_CONTINUOUS_MS = 45 * 60 * 1000;

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

function formatMinutes(ms) {
  return Math.max(1, Math.round(ms / 60000));
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
  return Boolean(title && artist && (spotifyTitle.includes(title) || title.includes(spotifyTitle)) && spotifyArtists.includes(artist));
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

function voicePartsFromPayload(payload) {
  const lines = payload?.transcript || [];
  const spokenLines = lines.filter((line) => !/你今天的关键词是/.test(line.text || ""));
  return spokenLines
    .slice(0, 4)
    .flatMap((line) => splitVoiceParts(line.text))
    .slice(0, 8);
}

function voiceTextFromPayload(payload) {
  const lines = payload?.transcript || [];
  return lines
    .filter((line) => !/你今天的关键词是/.test(line.text || ""))
    .slice(0, 3)
    .map((line) => naturalizeDjText(line.text))
    .filter(Boolean)
    .join("\n\n");
}

function voiceKeyFromPayload(payload) {
  const current = payload?.current?.id || "radiox";
  const index = payload?.state?.currentIndex ?? 0;
  const dateKey = payload?.context?.now?.dateKey || "";
  const plan = payload?.context?.planText || "";
  return `${dateKey}:${index}:${current}:${plan}`;
}

function restoreVoiceDucking() {
  const restore = app.voiceRestore;
  app.voiceRestore = null;
  restore?.();
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

    app.djAudioUrl = URL.createObjectURL(blob);
    app.djAudio = new Audio(app.djAudioUrl);
    app.voiceRestore = duckPlaybackForVoice();
    app.djAudio.onplay = () => setServerState(voiceLabel);
    app.djAudio.onended = () => {
      restoreVoiceDucking();
      if (app.djAudioUrl) URL.revokeObjectURL(app.djAudioUrl);
      app.djAudioUrl = "";
      app.djAudio = null;
      if (els.serverState?.textContent === voiceLabel) setServerState("READY");
    };
    app.djAudio.onerror = () => {
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
    setServerState("BROWSER VOICE");
    return false;
  }
}

async function playCloudDjVoice(payload, runId) {
  const text = voiceTextFromPayload(payload);
  return playCloudTextVoice(text, voiceKeyFromPayload(payload), runId);
}

function speakBrowserText(parts, runId) {
  if (!speechSupported()) return;
  const voice = preferredDjVoice();
  app.voiceRestore = duckPlaybackForVoice();
  const finish = () => {
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
    utterance.onstart = () => setServerState("BROWSER VOICE");
    utterance.onerror = finish;
    utterance.onend = () => {
      const pause = index === 0 ? 420 : 260;
      window.setTimeout(() => speakPart(index + 1), pause);
    };
    window.speechSynthesis.speak(utterance);
  };

  speakPart(0);
}

function speakBrowserDjIntro(parts, runId) {
  speakBrowserText(parts, runId);
}

async function speakDjIntro(payload, options = {}) {
  if (!app.voiceEnabled || !djVoiceSupported()) return;
  const parts = voicePartsFromPayload(payload);
  if (!parts.length) return;

  const key = voiceKeyFromPayload(payload);
  if (!options.force && app.lastSpokenKey === key) return;
  app.lastSpokenKey = key;

  stopDjVoice();
  const runId = app.voiceRunId;
  const ttsStarted = await playCloudDjVoice(payload, runId);
  if (!ttsStarted && runId === app.voiceRunId) speakBrowserDjIntro(parts, runId);
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

function render(payload) {
  app.payload = payload;
  const { current, context, profile, queue, transcript, state, aiDj } = payload;
  syncFavoritesFromServer(payload);
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
    els.duration.textContent = "0:00";
    els.elapsed.textContent = "0:00";
    els.progress.value = "0";
    els.playButton.textContent = "▶";
    els.favButton.textContent = "♡";
    updateVoiceButton();
    const djSource = aiDj?.source === "openai" ? "OPENAI" : "LOCAL";
    els.transcript.innerHTML = `
      <div class="dj-output-box">
        <div class="dj-output-toolbar">
          <span>DJ OUTPUT</span>
          <strong>${escapeHtml(djSource)}</strong>
        </div>
        <div class="dj-output-copy">
          <p>我在重新整理下一批歌。优先避开最近听过的曲目，继续往前推。</p>
        </div>
      </div>
    `;
    renderDjChat(state.djChat || []);
    els.contextReadout.innerHTML = `
      <div>weather: <strong>${escapeHtml(weatherReadout(context))}</strong></div>
      <div>mood: <strong>${context.mood}</strong> / intensity <strong>${context.intensity}</strong></div>
      <div>schedule: <strong>${context.scheduleTags.join(", ")}</strong></div>
    `;
    els.queueCount.textContent = `${queue.length} TRACKS`;
    els.queue.innerHTML = queue.map((track, index) => `
      <li data-queue-index="${index}">
        <div>
          <b>${escapeHtml(track.title)}</b>
          <span>${escapeHtml(track.artist)}</span>
          <small>${escapeHtml(track.story?.headline || "RadioX crate note")}</small>
        </div>
        <em>${String(index + 1).padStart(2, "0")}</em>
      </li>
    `).join("");
    renderTasteTags(profile);
    renderRestCue();
    scheduleSpotifyPrefetch();
    handleRemoteFavoriteRequest(payload);
    return;
  }
  els.trackTitle.textContent = current.title;
  els.trackArtist.textContent = `${current.artist} — ${current.genres.join(" / ")}`;
  els.duration.textContent = formatTime(current.duration);
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
  els.volume.value = state.volume;
  updateCurrentFavoriteButton();
  updateVoiceButton();

  const djSource = aiDj?.source === "openai" ? "OPENAI" : "LOCAL";
  els.transcript.innerHTML = `
    <div class="dj-output-box">
      <div class="dj-output-toolbar">
        <span>DJ OUTPUT</span>
        <strong>${escapeHtml(djSource)}</strong>
      </div>
      <div class="dj-output-copy">
        ${transcript.map((line) => `<p>${escapeHtml(line.text)}</p>`).join("")}
      </div>
    </div>
  `;
  renderDjChat(state.djChat || []);

  els.contextReadout.innerHTML = `
    <div>weather: <strong>${escapeHtml(weatherReadout(context))}</strong></div>
    <div>mood: <strong>${context.mood}</strong> / intensity <strong>${context.intensity}</strong></div>
    <div>schedule: <strong>${context.scheduleTags.join(", ")}</strong></div>
  `;

  els.queueCount.textContent = `${queue.length} TRACKS`;
  els.queue.innerHTML = queue.map((track, index) => `
    <li class="${track.id === current.id ? "active" : ""}" data-queue-index="${index}">
      <div>
        <b>${escapeHtml(track.title)}</b>
        <span>${escapeHtml(track.artist)}</span>
        <small>${escapeHtml(track.story?.headline || "RadioX crate note")}</small>
      </div>
      <em>${String(index + 1).padStart(2, "0")}</em>
    </li>
  `).join("");

  renderTasteTags(profile);
  renderRestCue();
  scheduleSpotifyPrefetch();
  handleRemoteFavoriteRequest(payload);
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

function renderTasteTags(profile) {
  if (!els.tasteTags || !profile) return;
  els.tasteTags.innerHTML = [...(profile.currentLean || []), ...(profile.tasteAnchors || []).slice(0, 10)]
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
    .join("");
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
    refreshDjForCurrent(payload.current?.id).catch(console.warn);
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

function relaxationScore(track) {
  let score = 0;
  const energy = Number(track.energy || 50);
  score += Math.max(0, 60 - energy);
  if (hasAny(track.genres, ["classical", "neo-classical", "jazz", "blues"])) score += 28;
  if (hasAny(track.genres, ["folk-rock", "pop-vocal"])) score += 12;
  if (hasAny(track.moods, ["breath", "recover", "blue"])) score += 18;
  if (hasAny(track.scheduleTags, ["recovery", "open"])) score += 10;
  if (energy > 70) score -= 36;
  return score;
}

function pickRestCueTrack(payload) {
  const queue = payload?.queue || [];
  const currentId = payload?.current?.id;
  return queue
    .map((track, index) => ({ track, index, score: relaxationScore(track) }))
    .filter((item) => item.track.id !== currentId)
    .sort((a, b) => b.score - a.score)[0] || null;
}

function restCueReason(payload) {
  const context = payload?.context || {};
  const now = Date.now();
  const sessionMs = now - app.restCue.sessionStartedAt;
  const busy = Number(context.intensity || 0) >= 4
    || hasAny(context.scheduleTags, ["meetings", "focus", "training"]);
  const continuous = sessionMs >= REST_CUE_CONTINUOUS_MS;
  const busyLongEnough = busy && sessionMs >= REST_CUE_BUSY_MS;

  if (busyLongEnough) {
    return {
      active: true,
      label: "BUSY",
      text: `你这轮已经撑了 ${formatMinutes(sessionMs)} 分钟，今天的安排也偏满。先放一首低能量的歌，把肩膀放下来。`
    };
  }
  if (continuous) {
    return {
      active: true,
      label: "LONG RUN",
      text: `你已经连续待在这一轮里 ${formatMinutes(sessionMs)} 分钟了。可以用一首慢一点的歌给注意力换个挡。`
    };
  }
  return {
    active: false,
    label: "WATCHING",
    text: `目前还不用急着打断。RadioX 已经在看这轮时长和今天的日程，合适的时候会轻轻提醒你。`
  };
}

function notificationsSupported() {
  return "Notification" in window;
}

function updateRestCueNotifyButton() {
  if (!els.restCueNotify) return;
  const supported = notificationsSupported();
  const permission = supported ? Notification.permission : "unsupported";
  els.restCueNotify.disabled = !supported || permission === "denied";
  els.restCueNotify.textContent = !supported
    ? "NO API"
    : permission === "denied"
      ? "DENIED"
      : app.restCue.notifyEnabled && permission === "granted"
        ? "NOTIFY ON"
        : "NOTIFY";
  els.restCueNotify.classList.toggle("connected", app.restCue.notifyEnabled && permission === "granted");
  els.restCueNotify.title = supported
    ? "浏览器最小化或切到后台时，用系统通知提醒你"
    : "当前浏览器不支持桌面通知";
}

async function requestRestCueNotifications() {
  if (!notificationsSupported()) return;
  const permission = Notification.permission === "default"
    ? await Notification.requestPermission()
    : Notification.permission;
  app.restCue.notifyEnabled = permission === "granted"
    ? !app.restCue.notifyEnabled || localStorage.getItem(REST_CUE_NOTIFY_KEY) !== "on"
    : false;

  if (permission === "granted") {
    localStorage.setItem(REST_CUE_NOTIFY_KEY, app.restCue.notifyEnabled ? "on" : "off");
  } else {
    localStorage.setItem(REST_CUE_NOTIFY_KEY, "off");
  }
  updateRestCueNotifyButton();
  renderRestCue();
}

function updateHiddenCueTitle(active) {
  document.title = document.hidden && active ? "● REST CUE - RadioX" : APP_TITLE;
}

async function showRestCueNotification(reason, suggestion) {
  if (
    !document.hidden
    || !app.restCue.notifyEnabled
    || !notificationsSupported()
    || Notification.permission !== "granted"
    || !suggestion?.track
  ) {
    return;
  }

  const key = `${reason.label}:${suggestion.track.id}`;
  if (app.restCue.lastNotificationKey === key) return;
  app.restCue.lastNotificationKey = key;

  const title = "RadioX 休息提示";
  const options = {
    body: `${reason.text}\n推荐：${suggestion.track.title} - ${suggestion.track.artist}`,
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    tag: "radiox-rest-cue",
    renotify: true,
    data: { url: window.location.href }
  };

  if ("serviceWorker" in navigator) {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, options);
    return;
  }

  const notification = new Notification(title, options);
  notification.onclick = () => {
    window.focus();
    notification.close();
  };
}

function renderRestCue() {
  if (!els.restCue || !app.payload) return;
  const dismissed = Date.now() < app.restCue.dismissedUntil;
  const reason = restCueReason(app.payload);
  const suggestion = pickRestCueTrack(app.payload);
  const active = reason.active && suggestion && !dismissed;
  app.restCue.recommendation = suggestion;

  els.restCue.classList.toggle("collapsed", !app.restCue.expanded);
  els.restCue.classList.toggle("active", Boolean(active));
  els.restCueToggle?.setAttribute("aria-expanded", String(app.restCue.expanded));
  if (els.restCueMini) els.restCueMini.textContent = active ? "ready" : reason.label.toLowerCase();
  if (els.restCueState) els.restCueState.textContent = active ? reason.label : (dismissed ? "LATER" : "READY");
  if (els.restCueText) els.restCueText.textContent = active
    ? reason.text
    : dismissed
      ? "我先不打扰你。稍后如果这一轮还在继续，我再提醒一次。"
      : "现在还不是强提醒；如果你想主动松一下，我已经挑好一首低能量的歌，点 PLAY 才会播放。";
  if (els.restCueTrack) els.restCueTrack.textContent = suggestion?.track?.title || "No cue yet";
  if (els.restCueArtist) els.restCueArtist.textContent = suggestion
    ? `${suggestion.track.artist} - ${suggestion.track.story?.headline || suggestion.track.genres.join(" / ")}`
    : "RadioX is listening for the right moment";
  if (els.restCueAccept) {
    els.restCueAccept.disabled = !suggestion;
    els.restCueAccept.title = suggestion
      ? `切到 ${suggestion.track.title}`
      : "当前 Queue 里还没有可切换的放松曲目";
  }
  updateRestCueNotifyButton();
  updateHiddenCueTitle(Boolean(active));
  showRestCueNotification(reason, suggestion).catch(console.warn);
}

function setRestCueExpanded(expanded) {
  app.restCue.expanded = Boolean(expanded);
  renderRestCue();
}

function dismissRestCue() {
  app.restCue.dismissedUntil = Date.now() + REST_CUE_DISMISS_MS;
  localStorage.setItem("radiox.restCueDismissedUntil", String(app.restCue.dismissedUntil));
  renderRestCue();
}

async function acceptRestCue() {
  const recommendation = app.restCue.recommendation || pickRestCueTrack(app.payload);
  if (!recommendation) return;
  app.restCue.dismissedUntil = Date.now() + REST_CUE_DISMISS_MS;
  localStorage.setItem("radiox.restCueDismissedUntil", String(app.restCue.dismissedUntil));
  const payload = await api("/api/jump", {
    method: "POST",
    body: JSON.stringify({ index: recommendation.index, trackId: recommendation.track.id, play: true })
  });
  if (app.playing) {
    applyTrackChange(payload, { deferVoice: true });
  } else {
    render(payload);
    app.elapsedBeforePlay = 0;
    app.startedAt = Date.now();
    await togglePlay();
  }
  refreshDjForCurrent(payload.current?.id).catch(console.warn);
  setRestCueExpanded(false);
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
  if (next) speakDjIntro(app.payload);
  else stopDjVoice();
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
  if (app.playing && !options.deferVoice) speakDjIntro(payload, { force: true });
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
    speakDjIntro(app.payload);
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
  if (currentChanged) refreshDjForCurrent(payload.current?.id).catch(console.warn);
}

async function nextTrack() {
  if (app.advancing) return;
  app.advancing = true;
  try {
    const payload = await api("/api/next", { method: "POST", body: "{}" });
    applyTrackChange(payload, { deferVoice: true });
    refreshDjForCurrent(payload.current?.id).catch(console.warn);
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
    refreshDjForCurrent(payload.current?.id).catch(console.warn);
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
    refreshDjForCurrent(payload.current?.id).catch(console.warn);
  } finally {
    app.advancing = false;
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

async function refreshDjForCurrent(expectedId) {
  const payload = await api("/api/now");
  if (expectedId && payload.current?.id !== expectedId) return;
  const wasPlaying = app.playing;
  const elapsed = playbackSeconds();
  if (payload.current?.id === app.payload?.current?.id && app.payload?.current?.duration) {
    payload.current.duration = app.payload.current.duration;
  }
  render(payload);
  app.elapsedBeforePlay = Math.min(elapsed, payload.current?.duration || elapsed);
  app.startedAt = Date.now();
  applyLocalPlayState(wasPlaying);
  renderProgress();
  if (wasPlaying) speakDjIntro(payload, { force: true });
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
  loadAudioFeaturesForSpotifyTrack(app.payload?.current, spotifyTrack).catch(console.warn);
  syncFavoriteStatusFromSpotify(app.payload?.current).catch(console.warn);
  const autoAdvancing = syncSpotifyPlaybackState(spotifyState, actualUri || app.expectedSpotifyUri);
  if (autoAdvancing) return true;
  app.playing = !spotifyState.paused;
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
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
    console.warn(error);
    setServerState(/spotify/i.test(error.message || "") ? "LOGIN ERR" : "READY");
    return app.spotify.status();
  });
  updateSpotifyButton();
  app.spotifyLibrarySyncDisabled = false;
  const shouldAutoConnect = app.spotify?.justAuthenticated;
  app.spotify.addEventListener("ready", () => {
    app.playbackMode = app.playbackMode === "spotify" ? "spotify" : app.playbackMode;
    updateSpotifyButton();
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
    els.spotifyButton.textContent = app.spotify?.configured()
      ? (app.spotify?.status().authenticated ? "CONNECT" : "LOGIN")
      : "SET SPOTIFY";
    els.spotifyButton.classList.remove("connected");
    if (app.playbackMode === "spotify") {
      app.playbackMode = "idle";
      setPlaying(false);
    }
    console.warn(event.detail.message);
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
  els.restCueToggle?.addEventListener("click", () => setRestCueExpanded(!app.restCue.expanded));
  els.restCueNotify?.addEventListener("click", () => {
    requestRestCueNotifications().catch(console.warn);
  });
  els.restCueLater?.addEventListener("click", dismissRestCue);
  els.restCueAccept?.addEventListener("click", () => {
    acceptRestCue().catch((error) => {
      console.warn(error);
      setServerState("RETRY");
    });
  });
  ["pointerdown", "keydown"].forEach((eventName) => {
    window.addEventListener(eventName, () => {
      app.restCue.lastActivityAt = Date.now();
    }, { passive: true });
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      document.title = APP_TITLE;
      app.restCue.lastNotificationKey = "";
      syncForegroundPlayback();
    }
    renderRestCue();
  });
  window.addEventListener("focus", syncForegroundPlayback);
  window.addEventListener("pageshow", syncForegroundPlayback);
  els.queue.addEventListener("dblclick", (event) => {
    const item = event.target.closest("li[data-queue-index]");
    if (!item) return;
    jumpToQueueTrack(Number(item.dataset.queueIndex));
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
    if (app.voiceEnabled) speakDjIntro(app.payload, { force: true });
    else stopDjVoice();
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
      closeSpotifySetup();
      closeTasteSetup();
    }
  });
}

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
  setInterval(renderRestCue, 30000);
  setInterval(() => syncExternalState().catch(console.warn), 2000);
  setInterval(() => syncFavoriteStatusFromSpotify(app.payload?.current).catch(console.warn), 15000);
  bindEvents();
  await initSpotify();
  await refresh();
  scheduleSpotifyPrefetch();
  await syncSpotifyProgressFromPlayer().catch(console.warn);
  await syncFavoriteStatusFromSpotify(app.payload?.current, { force: true }).catch(console.warn);
  drawSpectrum();
  setServerState("READY");
}

main().catch((error) => {
  els.serverState.textContent = "ERROR";
  console.error(error);
});
