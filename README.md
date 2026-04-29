# RadioX

A local-first PWA prototype for a 24-hour personal AI DJ. It uses your taste profile, the day context, weather, mood, and schedule pressure to build a queue and DJ patter. Spotify is optional: without credentials it runs in local simulation mode with a procedural Web Audio sound bed.

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:8765`.

## Floating Toolbar

RadioX includes a tiny macOS companion toolbar that stays available even when the browser is minimized. By default it is visually hidden at the top center of the screen. Move the mouse into that invisible top-center hot zone to drop down minimal info, single-click for detailed station context, and double-click to open the full RadioX web UI. REST CUE lives here now: the toolbar can suggest a lower-energy track, let you choose `PLAY`, or snooze it with `LATER`.

```bash
scripts/radiox-bar
```

The toolbar talks to the local server at `http://127.0.0.1:8765`, so start RadioX first with `npm run dev`. Click the expanded toolbar's `QUIT` button to close it.

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

## AI DJ Setup

RadioX can use OpenAI for the DJ writing and either Inworld or OpenAI for the DJ voice. The Responses API turns the local song story, your mood, weather, schedule text, and taste profile into a warmer radio-DJ intro. The TTS provider turns that DJ output into generated speech. If cloud TTS is missing or a request fails, RadioX falls back to the browser's local SpeechSynthesis.

```bash
export OPENAI_API_KEY="your-openai-api-key"
export OPENAI_MODEL="gpt-5.5"
export TTS_PROVIDER="auto"

# Preferred when present: Inworld TTS
export INWORLD_API_KEY="your-inworld-basic-api-key"
export INWORLD_TTS_MODEL="inworld-tts-1.5-max"
export INWORLD_TTS_VOICE_ID="Dennis"

# Fallback cloud TTS
export OPENAI_TTS_MODEL="gpt-4o-mini-tts"
export OPENAI_TTS_VOICE="marin"
export OPENAI_TTS_SPEED="0.88"
npm run dev
```

You can also place those values in a local `.env` file. The server loads `.env` on startup, and `.env` is ignored by git. `TTS_PROVIDER=auto` prefers Inworld when `INWORLD_API_KEY` is set, otherwise it uses OpenAI TTS when configured. Set `TTS_PROVIDER=inworld` or `TTS_PROVIDER=openai` to force one provider.

## Simulated Audio

When Spotify is not connected, the play button starts a local Web Audio engine. It generates a radio bed from the current track's genre and energy: quiet recommendations lean toward pads/plucks, while rock recommendations add bass and drums. It is intentionally not a copy of the original song.

## DJ Voice

The `VOICE ON` control reads the same DJ output shown on screen. It prefers the configured cloud TTS provider and falls back to the browser's local SpeechSynthesis engine. Cloud voices are AI-generated audio; disclose that clearly if you use RadioX beyond personal listening.

## Files

- `server/index.js` local API and static file server
- `public/` PWA interface, service worker, Spotify bridge
- `macos/RadioXBar/RadioXBar.swift` always-on-top macOS companion toolbar
- `data/profile.json` taste profile
- `data/routines.json` daily context defaults
- `data/playlist-catalog.json` local recommendation seed catalog
- `data/state.json` mutable local station state

## Notes

This is designed as a personal interactive DJ. Spotify's platform policy should not be used for non-interactive public broadcasting, downloads, or syncing Spotify content into video.
