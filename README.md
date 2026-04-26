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

## Simulated Audio

When Spotify is not connected, the play button starts a local Web Audio engine. It generates a radio bed from the current track's genre and energy: quiet recommendations lean toward pads/plucks, while rock recommendations add bass and drums. It is intentionally not a copy of the original song.

## Files

- `server/index.js` local API and static file server
- `public/` PWA interface, service worker, Spotify bridge
- `data/profile.json` taste profile
- `data/routines.json` daily context defaults
- `data/playlist-catalog.json` local recommendation seed catalog
- `data/state.json` mutable local station state

## Notes

This is designed as a personal interactive DJ. Spotify's platform policy should not be used for non-interactive public broadcasting, downloads, or syncing Spotify content into video.
