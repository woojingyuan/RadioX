const assert = require("node:assert/strict");

const baseUrl = String(process.env.RADIOX_BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response;
}

async function post(pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(response.status, 200, `${pathname} should return HTTP 200`);
  return response;
}

async function main() {
  const indexResponse = await get("/");
  const html = await indexResponse.text();
  assert.match(html, /id="playButton"/, "player transport must be present");
  assert.match(html, /id="queue"/, "Queue must be present");
  assert.match(html, /data-world-filter="million"/, "million-sales map layer must be present");
  assert.match(html, /data-world-filter="grammy"/, "Grammy map layer must be present");
  assert.match(html, /data-world-filter="taste"/, "taste map layer must be present");
  assert.match(html, /id="worldCountryFocus"/, "country taste focus must be present");
  assert.match(html, /id="worldTasteLegend"/, "taste heat legend must be present");
  assert.match(html, /id="world3dCanvas"/, "Three.js globe enhancement must be present");
  assert.match(html, /id="worldAlbumOrbit"/, "album constellation must be present");
  assert.match(html, /id="playerAmbient"/, "Now Playing must expose its cover-driven ambience");
  assert.match(html, /id="trackReason"/, "Now Playing must explain why the track is scheduled");
  assert.match(html, /id="worldEra"/, "World Albums must provide an era timeline");

  const world3d = await (await get("/world-3d.mjs")).text();
  assert.match(world3d, /RadioXWorld3D/, "Three.js globe module must load");
  assert.match(world3d, /makeFocusBeacon/, "globe must expose a selected-band locator pulse");
  assert.match(world3d, /TorusGeometry/, "globe must expose music-reactive orbital rings");
  const appScript = await (await get("/app.js")).text();
  assert.match(appScript, /function worldTasteField\(/, "country taste heat field must be computed");
  assert.match(appScript, /data-taste-match=/, "band markers must expose their taste score");
  assert.match(appScript, /world-album-links/, "selected albums must render signal links");
  assert.match(appScript, /resolveWorldOverlayCollisions/, "album orbit must avoid ring-label collisions");
  assert.match(appScript, /\/api\/queue\/reorder/, "Queue drag ordering must persist to the server");
  assert.match(appScript, /function renderDjRecommendationCapsules\(/, "DJ replies must expose actionable music recommendations");
  const threeModule = await (await get("/vendor/three.module.js")).text();
  assert.match(threeModule, /WebGLRenderer/, "Three.js vendor module must be served");
  const threeCore = await (await get("/vendor/three.core.js")).text();
  assert.match(threeCore, /class Vector3/, "Three.js core module must be served");
  const manifest = await (await get("/manifest.webmanifest")).json();
  assert.ok(manifest.icons?.some((icon) => icon.sizes === "192x192"), "PWA must provide a 192px icon");
  assert.ok(manifest.icons?.some((icon) => icon.sizes === "512x512"), "PWA must provide a 512px icon");
  await get("/icons/icon-192.png");
  await get("/icons/icon-512.png");

  const now = await (await get("/api/now")).json();
  assert.equal(now.station?.name, "RadioX", "station identity must remain RadioX");
  assert.ok(Array.isArray(now.queue) && now.queue.length > 0, "Queue must contain tracks");
  assert.ok(now.queue.length <= 10, "Queue must keep the ten-track product limit");
  assert.equal(new Set(now.queue.map((track) => track.id)).size, now.queue.length, "Queue track ids must be unique");
  assert.ok(now.current?.id, "current track must be resolved");
  assert.ok(now.queue.some((track) => track.id === now.current.id), "current track must belong to Queue");

  if (now.queue.length > 1) {
    const originalOrder = now.queue.map((track) => track.id);
    const reorderedIds = [originalOrder[1], originalOrder[0], ...originalOrder.slice(2)];
    const reordered = await (await post("/api/queue/reorder", { trackIds: reorderedIds })).json();
    assert.deepEqual(reordered.queue.map((track) => track.id), reorderedIds, "Queue reorder must use the requested broadcast order");
    assert.equal(reordered.current?.id, now.current.id, "Queue reorder must preserve the currently playing track");
    const restored = await (await post("/api/queue/reorder", { trackIds: originalOrder })).json();
    assert.deepEqual(restored.queue.map((track) => track.id), originalOrder, "smoke test must restore the original Queue order");
  }

  const config = await (await get("/api/config")).json();
  const expectedProtocol = new URL(baseUrl).protocol;
  assert.equal(new URL(config.publicOrigin).protocol, expectedProtocol, "config origin must preserve request protocol");
  assert.equal(config.secureContext, expectedProtocol === "https:", "secure-context flag must match request protocol");
  if (expectedProtocol === "https:") {
    assert.equal(config.spotifyRedirectUri, `${baseUrl}/callback`, "HTTPS Spotify callback must return to the current RadioX origin");
  }
  if (config.httpsAvailable) {
    const caResponse = await get("/radiox-ca.cer");
    assert.match(caResponse.headers.get("content-type") || "", /x-x509-ca-cert/, "phone CA certificate must be downloadable");
  }

  const world = await (await get("/api/world/catalog")).json();
  assert.ok(Array.isArray(world.approved?.bands) && world.approved.bands.length > 0, "world map must expose bands");
  assert.ok(world.stats?.bands === world.approved.bands.length, "world band count must match payload");
  assert.ok(Number(world.stats?.futureTourStops) >= 0, "future tour count must be available");

  console.log(`RadioX smoke OK: ${now.queue.length} queue tracks, ${world.stats.bands} world bands, ${world.stats.futureTourStops} future tour stops.`);
}

main().catch((error) => {
  console.error(`RadioX smoke failed: ${error.message}`);
  process.exitCode = 1;
});
