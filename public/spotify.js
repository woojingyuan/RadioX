(function () {
  const TOKEN_KEY = "radiox.spotify.token";
  const VERIFIER_KEY = "radiox.spotify.verifier";
  const STATE_KEY = "radiox.spotify.state";

  function randomString(length) {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
    const values = crypto.getRandomValues(new Uint8Array(length));
    return Array.from(values, (x) => possible[x % possible.length]).join("");
  }

  async function sha256(value) {
    const data = new TextEncoder().encode(value);
    return crypto.subtle.digest("SHA-256", data);
  }

  function base64Url(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");
  }

  async function requestToken(body) {
    const response = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(body)
    });
    if (!response.ok) {
      throw new Error(`Spotify token request failed: ${response.status}`);
    }
    return response.json();
  }

  function withTimeout(promise, timeoutMs, message) {
    return new Promise((resolve, reject) => {
      const timer = window.setTimeout(() => reject(new Error(message)), timeoutMs);
      promise.then(
        (value) => {
          window.clearTimeout(timer);
          resolve(value);
        },
        (error) => {
          window.clearTimeout(timer);
          reject(error);
        }
      );
    });
  }

  class SpotifyBridge extends EventTarget {
    constructor() {
      super();
      this.config = null;
      this.player = null;
      this.deviceId = null;
      this.ready = false;
      this.connecting = null;
    }

    async init(config) {
      this.config = config;
      await this.handleCallback();
      await this.getAccessToken().catch((error) => {
        console.warn(error);
        if (/token|auth/i.test(error.message)) this.clearToken();
        return null;
      });
      return this.status();
    }

    configured() {
      return Boolean(this.config?.spotifyClientId);
    }

    status() {
      return {
        configured: this.configured(),
        connected: Boolean(this.deviceId),
        deviceId: this.deviceId,
        authenticated: Boolean(this.readToken())
      };
    }

    readToken() {
      try {
        return JSON.parse(localStorage.getItem(TOKEN_KEY) || "null");
      } catch {
        return null;
      }
    }

    writeToken(token) {
      const expiresAt = Date.now() + Number(token.expires_in || 3600) * 1000 - 60_000;
      localStorage.setItem(TOKEN_KEY, JSON.stringify({ ...token, expiresAt }));
    }

    clearToken() {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(VERIFIER_KEY);
      localStorage.removeItem(STATE_KEY);
    }

    resetPlayer() {
      try {
        this.player?.disconnect?.();
      } catch {
        /* no-op */
      }
      this.player = null;
      this.deviceId = null;
      this.ready = false;
      this.connecting = null;
    }

    async getAccessToken() {
      const token = this.readToken();
      if (!token) throw new Error("Spotify not authenticated");
      if (token.expiresAt > Date.now()) return token.access_token;
      if (!token.refresh_token) throw new Error("Spotify token expired");
      const next = await requestToken({
        client_id: this.config.spotifyClientId,
        grant_type: "refresh_token",
        refresh_token: token.refresh_token
      });
      this.writeToken({ ...token, ...next, refresh_token: next.refresh_token || token.refresh_token });
      return this.readToken().access_token;
    }

    async login() {
      if (!this.configured()) {
        throw new Error("Missing SPOTIFY_CLIENT_ID");
      }
      const verifier = randomString(64);
      const state = randomString(20);
      const challenge = base64Url(await sha256(verifier));
      localStorage.setItem(VERIFIER_KEY, verifier);
      localStorage.setItem(STATE_KEY, state);

      const params = new URLSearchParams({
        client_id: this.config.spotifyClientId,
        response_type: "code",
        redirect_uri: this.config.spotifyRedirectUri,
        code_challenge_method: "S256",
        code_challenge: challenge,
        state,
        scope: [
          "streaming",
          "user-read-email",
          "user-read-private",
          "user-read-playback-state",
          "user-modify-playback-state",
          "user-read-currently-playing"
        ].join(" ")
      });
      window.location.href = `https://accounts.spotify.com/authorize?${params.toString()}`;
    }

    async handleCallback() {
      const url = new URL(window.location.href);
      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      if (!code) return;

      const verifier = localStorage.getItem(VERIFIER_KEY);
      const expectedState = localStorage.getItem(STATE_KEY);
      if (!verifier || returnedState !== expectedState) {
        throw new Error("Spotify callback state mismatch");
      }

      const token = await requestToken({
        client_id: this.config.spotifyClientId,
        grant_type: "authorization_code",
        code,
        redirect_uri: this.config.spotifyRedirectUri,
        code_verifier: verifier
      });
      this.writeToken(token);
      localStorage.removeItem(VERIFIER_KEY);
      localStorage.removeItem(STATE_KEY);
      history.replaceState({}, document.title, "/");
    }

    waitForReady(timeoutMs = 9000) {
      if (this.deviceId) return Promise.resolve(this.deviceId);
      return new Promise((resolve, reject) => {
        const timer = window.setTimeout(() => {
          cleanup();
          reject(new Error("Spotify player did not become ready"));
        }, timeoutMs);
        const cleanup = () => {
          window.clearTimeout(timer);
          this.removeEventListener("ready", onReady);
          this.removeEventListener("error", onError);
        };
        const onReady = (event) => {
          cleanup();
          resolve(event.detail.deviceId);
        };
        const onError = (event) => {
          cleanup();
          reject(new Error(event.detail?.message || "Spotify player error"));
        };
        this.addEventListener("ready", onReady);
        this.addEventListener("error", onError);
      });
    }

    async loadPlayer() {
      if (!this.configured()) throw new Error("Missing SPOTIFY_CLIENT_ID");
      if (this.deviceId) return this.deviceId;
      if (this.connecting) return this.connecting;
      this.connecting = withTimeout(
        this.connectPlayer(),
        12000,
        "Spotify connect timed out"
      );
      try {
        return await this.connecting;
      } finally {
        this.connecting = null;
      }
    }

    async connectPlayer() {
      await this.getAccessToken();
      await withTimeout(new Promise((resolve, reject) => {
        if (window.Spotify) {
          resolve();
          return;
        }
        const existing = document.querySelector("script[data-radiox-spotify-sdk]");
        if (existing) {
          window.onSpotifyWebPlaybackSDKReady = resolve;
          return;
        }
        const script = document.createElement("script");
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        script.dataset.radioxSpotifySdk = "true";
        script.onerror = () => reject(new Error("Could not load Spotify SDK"));
        window.onSpotifyWebPlaybackSDKReady = resolve;
        document.head.appendChild(script);
      }), 9000, "Spotify SDK load timed out");

      if (this.player && !this.deviceId) this.resetPlayer();

      if (!this.player) {
        this.player = new Spotify.Player({
          name: "RadioX",
          getOAuthToken: async (callback) => callback(await this.getAccessToken()),
          volume: 0.76
        });

        this.player.addListener("ready", ({ device_id }) => {
          this.deviceId = device_id;
          this.ready = true;
          this.dispatchEvent(new CustomEvent("ready", { detail: { deviceId: device_id } }));
        });
        this.player.addListener("not_ready", () => {
          this.ready = false;
          this.deviceId = null;
          this.dispatchEvent(new Event("notready"));
        });
        this.player.addListener("initialization_error", ({ message }) => this.dispatchError(message));
        this.player.addListener("authentication_error", ({ message }) => {
          this.clearToken();
          this.dispatchError(message);
        });
        this.player.addListener("account_error", ({ message }) => this.dispatchError(message));
        this.player.addListener("playback_error", ({ message }) => this.dispatchError(message));
        this.player.addListener("autoplay_failed", () => this.dispatchError("Spotify autoplay was blocked. Press play again."));
      }

      const connected = await withTimeout(
        this.player.connect(),
        5000,
        "Spotify player connection timed out"
      );
      if (connected === false) throw new Error("Spotify player connection was rejected");
      return this.waitForReady();
    }

    dispatchError(message) {
      this.dispatchEvent(new CustomEvent("error", { detail: { message } }));
    }

    async searchTrack(query) {
      const token = await this.getAccessToken();
      const url = new URL("https://api.spotify.com/v1/search");
      url.searchParams.set("q", query);
      url.searchParams.set("type", "track");
      url.searchParams.set("limit", "1");
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error(`Spotify search failed: ${response.status}`);
      const data = await response.json();
      return data.tracks?.items?.[0] || null;
    }

    async playQuery(query) {
      const token = await this.getAccessToken();
      await this.loadPlayer();
      if (this.player?.activateElement) await this.player.activateElement();
      const track = await this.searchTrack(query);
      if (!track) throw new Error("Track not found on Spotify");
      const endpoint = new URL("https://api.spotify.com/v1/me/player/play");
      endpoint.searchParams.set("device_id", this.deviceId);
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ uris: [track.uri] })
      });
      if (!response.ok && response.status !== 204) {
        throw new Error(`Spotify play failed: ${response.status}`);
      }
      return track;
    }

    async toggle() {
      if (this.player) await this.player.togglePlay();
    }

    async pause() {
      const token = await this.getAccessToken();
      const endpoint = new URL("https://api.spotify.com/v1/me/player/pause");
      if (this.deviceId) endpoint.searchParams.set("device_id", this.deviceId);
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok || response.status === 204 || response.status === 404) return;
      if (this.player) {
        await this.player.togglePlay();
        return;
      }
      throw new Error(`Spotify pause failed: ${response.status}`);
    }

    async setVolume(value) {
      if (this.player) await this.player.setVolume(Math.max(0, Math.min(1, Number(value) || 0)));
    }

    async seek(positionMs) {
      const safePosition = Math.max(0, Math.floor(Number(positionMs) || 0));
      const token = await this.getAccessToken();
      const endpoint = new URL("https://api.spotify.com/v1/me/player/seek");
      endpoint.searchParams.set("position_ms", String(safePosition));
      if (this.deviceId) endpoint.searchParams.set("device_id", this.deviceId);
      const response = await fetch(endpoint, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok || response.status === 204) return;

      if (this.player?.seek) {
        await this.player.seek(safePosition);
        return;
      }

      throw new Error(`Spotify seek failed: ${response.status}`);
    }
  }

  window.SpotifyBridge = SpotifyBridge;
})();
