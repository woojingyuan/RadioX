# RadioX

A local-first PWA prototype for a 24-hour personal AI DJ. It uses your taste profile, the day context, weather, mood, and schedule pressure to build a queue and DJ patter. Spotify is optional: without credentials it runs in local simulation mode with a procedural Web Audio sound bed.

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:8765`.

## Spotify Setup

Create a Spotify app, add `http://127.0.0.1:8765/callback` as a redirect URI, and choose Web Playback SDK as an API. Then either paste the app's Client ID into the in-app `SET SPOTIFY` dialog, or set:

```bash
export SPOTIFY_CLIENT_ID="your-client-id"
export SPOTIFY_REDIRECT_URI="http://127.0.0.1:8765/callback"
npm run dev
```

Spotify playback requires a Spotify Premium account and the Web Playback SDK. The app uses Authorization Code with PKCE in the browser, so no client secret is stored locally.

In the app:

1. Click `SET SPOTIFY`.
2. Paste the Spotify app Client ID.
3. Save, then click `LOGIN`.
4. After Spotify redirects back, press play.

The first time you use Spotify favorites, you may need to log in again because RadioX requests the `user-library-modify` scope to save tracks to your Spotify library.

## OpenAI DJ Setup

RadioX can use OpenAI for both the DJ writing and the DJ voice. The Responses API turns the local song story, your mood, weather, schedule text, and taste profile into a warmer radio-DJ intro. The Audio Speech API turns that DJ output into generated speech. If `OPENAI_API_KEY` is missing or a request fails, RadioX falls back to local scripted lines and browser SpeechSynthesis.

```bash
export OPENAI_API_KEY="your-openai-api-key"
export OPENAI_MODEL="gpt-5-mini"
export OPENAI_TTS_MODEL="gpt-4o-mini-tts"
export OPENAI_TTS_VOICE="sage"
export OPENAI_TTS_SPEED="0.88"
npm run dev
```

You can also place those values in a local `.env` file. The server loads `.env` on startup, and `.env` is ignored by git.

## Simulated Audio

When Spotify is not connected, the play button starts a local Web Audio engine. It generates a radio bed from the current track's genre and energy: quiet recommendations lean toward pads/plucks, while rock recommendations add bass and drums. It is intentionally not a copy of the original song.

## DJ Voice

The `VOICE ON` control reads the same DJ output shown on screen. It prefers OpenAI TTS when configured and falls back to the browser's local SpeechSynthesis engine. OpenAI voices are AI-generated audio; disclose that clearly if you use RadioX beyond personal listening.

## Files

- `server/index.js` local API and static file server
- `public/` PWA interface, service worker, Spotify bridge
- `data/profile.json` taste profile
- `data/routines.json` daily context defaults
- `data/playlist-catalog.json` local recommendation seed catalog
- `data/state.json` mutable local station state

## Notes

This is designed as a personal interactive DJ. Spotify's platform policy should not be used for non-interactive public broadcasting, downloads, or syncing Spotify content into video.
