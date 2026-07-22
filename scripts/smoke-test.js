const assert = require("node:assert/strict");

const baseUrl = String(process.env.RADIOX_BASE_URL || "http://127.0.0.1:8765").replace(/\/$/, "");

async function get(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`);
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

  const now = await (await get("/api/now")).json();
  assert.equal(now.station?.name, "RadioX", "station identity must remain RadioX");
  assert.ok(Array.isArray(now.queue) && now.queue.length > 0, "Queue must contain tracks");
  assert.ok(now.queue.length <= 10, "Queue must keep the ten-track product limit");
  assert.equal(new Set(now.queue.map((track) => track.id)).size, now.queue.length, "Queue track ids must be unique");
  assert.ok(now.current?.id, "current track must be resolved");
  assert.ok(now.queue.some((track) => track.id === now.current.id), "current track must belong to Queue");

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
