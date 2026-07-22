# RadioX

A local-first PWA prototype for a 24-hour personal AI DJ. It uses your taste profile, the day context, weather, mood, and schedule pressure to build a queue and DJ patter. Spotify is optional: without credentials it runs in local simulation mode with a procedural Web Audio sound bed.

## Run

```bash
npm run dev
```

Open `http://127.0.0.1:8765`.

## Phone HTTPS and PWA

Create a private RadioX certificate for the Mac's current Wi-Fi address, then restart RadioX:

```bash
npm run cert:setup
npm run dev
```

The startup output prints three phone URLs. On the phone, while connected to the same Wi-Fi:

1. Open the `RadioX phone CA` HTTP URL and install the downloaded `radiox-ca.cer` profile.
2. On iPhone, open Settings > General > About > Certificate Trust Settings and enable full trust for `RadioX Local CA`.
3. Open the `RadioX secure phone` HTTPS URL. This secure origin enables the service worker, installable PWA, Web Crypto PKCE, and mobile Spotify login.

The CA private key remains in the Git-ignored `data/certs/` directory. If the Mac's Wi-Fi IP changes, run `npm run cert:setup` again and restart the server. Android trust-menu wording varies by manufacturer.

## Floating Toolbar

RadioX includes a tiny macOS companion toolbar that stays available even when the browser is minimized. By default it is visually hidden at the top center of the screen. Move the mouse into that invisible top-center hot zone to drop down minimal info, single-click for detailed station context and playback controls, and double-click to open the full RadioX web UI.

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

For phone login, also add the exact `RadioX secure phone` callback printed at startup, for example `https://192.168.3.169:8766/callback`, to the Spotify app's Redirect URIs. RadioX automatically chooses the HTTPS callback when opened from that address. Spotify requires an exact HTTPS redirect for non-loopback addresses.

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
export INWORLD_TTS_LANGUAGE="zh"
export INWORLD_TTS_GENDER="female"
export INWORLD_TTS_VOICE_ID="Jing"

# Fallback cloud TTS
export OPENAI_TTS_MODEL="gpt-4o-mini-tts"
export OPENAI_TTS_VOICE="marin"
export OPENAI_TTS_SPEED="0.88"
npm run dev
```

You can also place those values in a local `.env` file. The server loads `.env` on startup, and `.env` is ignored by git. `TTS_PROVIDER=auto` prefers Inworld when `INWORLD_API_KEY` is set, otherwise it uses OpenAI TTS when configured. Set `TTS_PROVIDER=inworld` or `TTS_PROVIDER=openai` to force one provider. Inworld synthesis uses `voiceId`; `INWORLD_TTS_LANGUAGE` and `INWORLD_TTS_GENDER` document the voice selection preference used when choosing a voice in the Inworld library.

## OpenWeather Setup

RadioX can use OpenWeather current conditions to replace the local routine weather label. Configure your OpenWeather API key and coordinates; RadioX refreshes in the background, caches the result, maps it to local tags such as `rain`, `cloudy`, `windy`, `hot`, or `cold`, and falls back to `data/routines.json` if the API is missing or unavailable.

```bash
export OPENWEATHER_API_KEY="your-openweather-api-key"
export OPENWEATHER_LAT="35.6812"
export OPENWEATHER_LON="139.7671"
export OPENWEATHER_LOCATION_LABEL="Tokyo"
export OPENWEATHER_UNITS="metric"
export OPENWEATHER_LANG="zh_cn"
```

## World Album Globe

The globe is local-first. Curated album and artist data lives in `public/world-bands.js`, while future tour overlays live in `public/world-tours.js`. The UI filters tour stops to future dates only; if an artist has no future verified stops, the globe stays in album/match mode and does not show historical tour status copy.

RadioX also has a small review queue for semi-automatic data ingestion:

- `GET /api/world/catalog` returns curated data, pending review items, provider readiness, and future-tour stats.
- `POST /api/world/sync-preview` accepts candidate artist/album/tour records and stores them as `pending`.
- `POST /api/world/approve` approves or rejects a pending item. Approved records are merged into the globe at runtime.

Optional provider configuration for future sync tooling:

```bash
export MUSICBRAINZ_USER_AGENT="RadioX/0.1 your-email@example.com"
export TICKETMASTER_API_KEY="optional-ticketmaster-key"
export BANDSINTOWN_APP_ID="optional-bandsintown-app-id"
```

The first product version does not auto-publish external data. Official artist sites, Spotify metadata, MusicBrainz, Wikidata, Ticketmaster, and Bandsintown are treated as candidate sources, and reviewed data remains local.

Validate the globe data with:

```bash
npm run validate:world
```

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
- `data/world-pending.json` local review queue for world music candidates
- `data/world-approved.json` approved world music candidates
- `data/state.example.json` clean template for local station state
- `data/state.json` mutable local station state, created locally and ignored by git

## Checks

Run deterministic syntax and world-data checks with:

```bash
npm test
```

With RadioX running, verify the live player, Queue, static UI, and world catalog API contracts with:

```bash
npm run smoke
```

Set `RADIOX_BASE_URL` to smoke-test another local instance. Tests that launch an isolated server can set `RADIOX_STATE_FILE` to keep the real listening history untouched.

## Notes

This is designed as a personal interactive DJ. Spotify's platform policy should not be used for non-interactive public broadcasting, downloads, or syncing Spotify content into video.
