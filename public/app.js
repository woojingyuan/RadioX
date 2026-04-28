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
  serverState: document.querySelector("#serverState"),
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
  lastSpokenKey: "",
  advancing: false,
  spotifyPlaySeq: 0,
  expectedSpotifyUri: "",
  spotifyMismatchTimer: null,
  favorites: new Set(JSON.parse(localStorage.getItem("radiox.favorites") || "[]"))
};

const SPOTIFY_CLIENT_ID_KEY = "radiox.spotify.clientId";
const SPOTIFY_TOKEN_KEY = "radiox.spotify.token";
const DJ_VOICE_KEY = "radiox.djVoice";

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

function speechSupported() {
  return "speechSynthesis" in window && "SpeechSynthesisUtterance" in window;
}

function djVoiceSupported() {
  return Boolean(app.spotifyConfig?.openAiTtsConfigured || speechSupported());
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
  if (["TALKING", "VOICE", "OPENAI VOICE", "BROWSER VOICE"].includes(els.serverState?.textContent)) setServerState("READY");
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

async function playOpenAiDjVoice(payload, runId) {
  if (!app.spotifyConfig?.openAiTtsConfigured) return false;
  const text = voiceTextFromPayload(payload);
  if (!text) return false;

  try {
    setServerState("VOICE");
    const response = await fetch("/api/dj-audio", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        key: voiceKeyFromPayload(payload),
        text
      })
    });
    if (!response.ok) throw new Error(`/api/dj-audio ${response.status}`);
    const blob = await response.blob();
    if (runId !== app.voiceRunId) return true;

    app.djAudioUrl = URL.createObjectURL(blob);
    app.djAudio = new Audio(app.djAudioUrl);
    app.voiceRestore = duckPlaybackForVoice();
    app.djAudio.onplay = () => setServerState("OPENAI VOICE");
    app.djAudio.onended = () => {
      restoreVoiceDucking();
      if (app.djAudioUrl) URL.revokeObjectURL(app.djAudioUrl);
      app.djAudioUrl = "";
      app.djAudio = null;
      if (els.serverState?.textContent === "OPENAI VOICE") setServerState("READY");
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
    console.warn("OpenAI TTS voice fallback", error);
    setServerState("BROWSER VOICE");
    return false;
  }
}

function speakBrowserDjIntro(parts, runId) {
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

async function speakDjIntro(payload, options = {}) {
  if (!app.voiceEnabled || !djVoiceSupported()) return;
  const parts = voicePartsFromPayload(payload);
  if (!parts.length) return;

  const key = voiceKeyFromPayload(payload);
  if (!options.force && app.lastSpokenKey === key) return;
  app.lastSpokenKey = key;

  stopDjVoice();
  const runId = app.voiceRunId;
  const ttsStarted = await playOpenAiDjVoice(payload, runId);
  if (!ttsStarted && runId === app.voiceRunId) speakBrowserDjIntro(parts, runId);
}

async function syncFavoriteToSpotify(track) {
  if (!track || !app.spotify?.configured()) return false;
  if (!app.spotify.status().authenticated) {
    els.spotifyButton.textContent = "LOGIN";
    setServerState("LOGIN");
    return false;
  }

  const previousFavText = els.favButton.textContent;
  const previousSpotifyText = els.spotifyButton.textContent;
  els.favButton.textContent = "…";
  els.spotifyButton.textContent = "SAVING";
  try {
    const spotifyTrack = await app.spotify.saveTrackToLibrary(track);
    app.spotifyTrack = spotifyTrack;
    els.favButton.textContent = "♥";
    els.spotifyButton.textContent = "SAVED";
    setServerState("SAVED");
    window.setTimeout(() => {
      if (els.spotifyButton.textContent === "SAVED") updateSpotifyButton();
      setServerState("READY");
    }, 1200);
    return true;
  } catch (error) {
    console.warn(error);
    els.favButton.textContent = previousFavText;
    if (/permission|auth|token|401|403/i.test(error.message)) {
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

function render(payload) {
  app.payload = payload;
  const { current, context, profile, queue, transcript, state, aiDj } = payload;
  els.heroLine.textContent = heroFromContext(context);
  els.trackTitle.textContent = current.title;
  els.trackArtist.textContent = `${current.artist} — ${current.genres.join(" / ")}`;
  els.duration.textContent = formatTime(current.duration);
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
  els.volume.value = state.volume;
  els.favButton.textContent = app.favorites.has(current.id) ? "♥" : "♡";
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
    <div>weather: <strong>${context.weather}</strong></div>
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

  els.tasteTags.innerHTML = [...profile.currentLean, ...profile.tasteAnchors.slice(0, 10)]
    .map((tag) => `<span class="chip">${escapeHtml(tag)}</span>`)
    .join("");
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

function renderDjChat(messages) {
  if (!els.djChatLog) return;
  els.djChatLog.innerHTML = (messages || []).map((message) => {
    const role = message.role === "user" ? "user" : "assistant";
    const name = role === "user" ? "YOU" : "RADIOX";
    return `
      <article class="dj-message ${role}">
        <small>${name}</small>
        <p>${escapeHtml(message.text || "")}</p>
      </article>
    `;
  }).join("");
  els.djChatLog.scrollTop = els.djChatLog.scrollHeight;
}

async function sendDjChat(event) {
  event.preventDefault();
  const text = els.djChatInput?.value.trim();
  if (!text) return;

  const existing = app.payload?.state?.djChat || [];
  const optimistic = [
    ...existing,
    { role: "user", text },
    { role: "assistant", text: "我听见了，等我把这首歌和你今天的状态对一下..." }
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
    if (app.payload?.state) app.payload.state.djChat = response.messages || [];
    renderDjChat(response.messages || []);
    setServerState("READY");
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

function setPlaying(playing) {
  if (playing === app.playing) return;
  app.playing = playing;
  if (playing) {
    app.startedAt = Date.now();
  } else {
    app.elapsedBeforePlay = playbackSeconds();
  }
  els.playButton.textContent = app.playing ? "Ⅱ" : "▶";
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

async function playCurrentOnSpotify(track) {
  if (!track || !app.spotify?.status().authenticated) return null;
  const playSeq = ++app.spotifyPlaySeq;
  const targetId = track.id;
  setServerState("SPOTIFY");
  els.spotifyButton.textContent = app.spotify?.status().connected ? "TUNING" : "CONNECTING";
  els.spotifyButton.classList.remove("connected");

  const spotifyTrack = await app.spotify.playQuery(track);
  if (playSeq !== app.spotifyPlaySeq || app.payload?.current?.id !== targetId) {
    if (app.payload?.current && app.playing) playCurrentOnSpotify(app.payload.current).catch(console.warn);
    return null;
  }

  app.spotifyTrack = spotifyTrack;
  app.expectedSpotifyUri = spotifyTrack?.uri || "";
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
  app.spotifyPlaySeq += 1;
  app.expectedSpotifyUri = "";
  app.playbackMode = "idle";
  app.playing = false;
  app.elapsedBeforePlay = 0;
  app.startedAt = Date.now();
  els.playButton.textContent = "▶";
  api("/api/play-state", {
    method: "POST",
    body: JSON.stringify({ playing: false, volume: Number(els.volume.value) })
  }).catch(console.warn);
}

function applyTrackChange(payload) {
  render(payload);
  app.elapsedBeforePlay = 0;
  app.startedAt = Date.now();
  if (app.playing && app.spotify?.status().authenticated) {
    playCurrentOnSpotify(payload.current).catch((error) => {
      console.warn(error);
      app.expectedSpotifyUri = "";
      app.spotify?.pause().catch(console.warn);
      setPlaying(false);
      app.playbackMode = "idle";
      updateSpotifyButton();
    });
  } else if (app.playing) {
    startSimAudio().catch(console.warn);
  }
  if (app.playing) speakDjIntro(payload, { force: true });
}

async function nextTrack() {
  if (app.advancing) return;
  app.advancing = true;
  try {
    const payload = await api("/api/next", { method: "POST", body: "{}" });
    applyTrackChange(payload);
  } finally {
    app.advancing = false;
  }
}

async function previousTrack() {
  if (app.advancing) return;
  app.advancing = true;
  try {
    const payload = await api("/api/previous", { method: "POST", body: "{}" });
    applyTrackChange(payload);
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
    const payload = await api("/api/jump", {
      method: "POST",
      body: JSON.stringify({ index })
    });
    applyTrackChange(payload);
  } finally {
    app.advancing = false;
  }
}

function drawSpectrum() {
  const canvas = els.spectrum;
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
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
  const t = performance.now() / 620;
  const energy = (app.payload?.current?.energy || 45) / 100;
  for (let i = 0; i < bars; i += 1) {
    const wave = Math.sin(i * 0.29 + t) * 0.5 + Math.sin(i * 0.11 - t * 1.4) * 0.5;
    const pulse = app.playing ? Math.sin(t * 3 + i * 0.47) * 0.5 + 0.5 : 0.22;
    const normalized = Math.max(0.08, Math.abs(wave) * 0.72 + pulse * energy * 0.42);
    const barHeight = normalized * h * 0.74;
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
    return app.spotify.status();
  });
  updateSpotifyButton();
  app.spotify.addEventListener("ready", () => {
    app.playbackMode = app.playbackMode === "spotify" ? "spotify" : app.playbackMode;
    updateSpotifyButton();
    api("/api/play-state", {
      method: "POST",
      body: JSON.stringify({ playing: app.playing, spotifyDeviceId: app.spotify.deviceId })
    }).catch(console.warn);
  });
  app.spotify.addEventListener("playerstate", (event) => {
    const actualUri = event.detail?.currentTrack?.uri;
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
  els.spotifyButton.textContent = "LOGIN";
  els.spotifyButton.classList.remove("connected");
}

function bindEvents() {
  els.playButton.addEventListener("click", togglePlay);
  els.nextButton.addEventListener("click", nextTrack);
  els.prevButton.addEventListener("click", previousTrack);
  els.queue.addEventListener("dblclick", (event) => {
    const item = event.target.closest("li[data-queue-index]");
    if (!item) return;
    jumpToQueueTrack(Number(item.dataset.queueIndex));
  });
  els.favButton.addEventListener("click", async () => {
    const id = app.payload?.current?.id;
    if (!id) return;
    const isFavorite = app.favorites.has(id);
    if (isFavorite) {
      app.favorites.delete(id);
    } else {
      app.favorites.add(id);
    }
    saveFavorites();
    els.favButton.textContent = app.favorites.has(id) ? "♥" : "♡";
    if (!isFavorite) await syncFavoriteToSpotify(app.payload.current);
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
      await app.spotify.login();
      return;
    }
    await connectSpotify();
  });
  els.spotifySetupClose?.addEventListener("click", closeSpotifySetup);
  els.spotifySaveButton?.addEventListener("click", saveSpotifyClientId);
  els.djChatForm?.addEventListener("submit", sendDjChat);
  els.spotifyLoginButton?.addEventListener("click", async () => {
    const clientId = els.spotifyClientIdInput.value.trim();
    if (clientId && clientId !== localStorage.getItem(SPOTIFY_CLIENT_ID_KEY)) {
      localStorage.setItem(SPOTIFY_CLIENT_ID_KEY, clientId);
      localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      app.spotifyConfig = {
        ...app.spotifyConfig,
        spotifyClientId: clientId
      };
      app.spotify = new SpotifyBridge();
      await app.spotify.init(app.spotifyConfig);
    }
    if (app.spotify?.configured()) await app.spotify.login();
  });
  els.spotifySetup?.addEventListener("click", (event) => {
    if (event.target === els.spotifySetup) closeSpotifySetup();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSpotifySetup();
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
  bindEvents();
  await initSpotify();
  await refresh();
  drawSpectrum();
  setServerState("READY");
}

main().catch((error) => {
  els.serverState.textContent = "ERROR";
  console.error(error);
});
