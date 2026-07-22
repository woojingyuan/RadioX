const fs = require("fs");
const path = require("path");
const vm = require("vm");

const ROOT = path.join(__dirname, "..");
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = path.join(ROOT, "data");
const today = process.env.RADIOX_VALIDATE_DATE || new Intl.DateTimeFormat("en-CA", {
  timeZone: process.env.RADIOX_TIME_ZONE || "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit"
}).format(new Date());

function readText(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readJson(fileName, fallback) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) return fallback;
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function loadWorldGlobals() {
  const context = { window: {} };
  vm.createContext(context);
  ["world-bands.js", "world-tours.js"].forEach((fileName) => {
    vm.runInContext(readText(path.join(PUBLIC_DIR, fileName)), context, { filename: fileName });
  });
  return {
    bands: Array.isArray(context.window.RADIOX_WORLD_BANDS) ? context.window.RADIOX_WORLD_BANDS : [],
    tours: context.window.RADIOX_WORLD_TOURS || {}
  };
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ""))) return false;
  return !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function futureStops(stops) {
  return (Array.isArray(stops) ? stops : []).filter((stop) => String(stop.endDate || stop.date || "") >= today);
}

function fail(errors, message) {
  errors.push(message);
}

function validateReviewItems(errors, fileName, expectedStatus) {
  const data = readJson(fileName, { items: [] });
  (Array.isArray(data.items) ? data.items : []).forEach((item, index) => {
    const label = `${fileName}#${index + 1}`;
    if (expectedStatus && item.status !== expectedStatus) fail(errors, `${label}: expected status ${expectedStatus}`);
    if (!item.artist?.name && !item.band?.name) fail(errors, `${label}: artist/band name is required`);
    if (!item.artist?.country && !item.band?.country) fail(errors, `${label}: country is required`);
    if (item.tour?.dates) {
      item.tour.dates.forEach((stop, stopIndex) => {
        if (!validDate(stop.date)) fail(errors, `${label}.tour[${stopIndex}]: invalid date`);
        if (!stop.city || !stop.country || !stop.venue) fail(errors, `${label}.tour[${stopIndex}]: city/country/venue are required`);
        if (!item.source?.label && !stop.source?.label) fail(errors, `${label}.tour[${stopIndex}]: source label is required`);
      });
    }
  });
}

function main() {
  const errors = [];
  const { bands, tours } = loadWorldGlobals();
  const bandIds = new Set(bands.map((band) => band.id).filter(Boolean));

  if (!bands.length) fail(errors, "RADIOX_WORLD_BANDS is empty");
  Object.entries(tours).forEach(([bandId, tour]) => {
    if (!bandIds.has(bandId)) fail(errors, `tour id does not map to a band: ${bandId}`);
    (tour.stops || []).forEach((stop, index) => {
      if (!validDate(stop.date)) fail(errors, `${bandId}.stops[${index}]: invalid date`);
      if (stop.endDate && !validDate(stop.endDate)) fail(errors, `${bandId}.stops[${index}]: invalid endDate`);
      if (futureStops([stop]).length && (!stop.city || !stop.country || !stop.venue)) {
        fail(errors, `${bandId}.stops[${index}]: future stops require city/country/venue`);
      }
    });
  });

  validateReviewItems(errors, "world-pending.json", "pending");
  validateReviewItems(errors, "world-approved.json", "approved");

  const futureTourBands = Object.values(tours).filter((tour) => futureStops(tour.stops).length).length;
  const futureTourStops = Object.values(tours).reduce((sum, tour) => sum + futureStops(tour.stops).length, 0);
  console.log(`World data OK check date: ${today}`);
  console.log(`Bands: ${bands.length}`);
  console.log(`Tour bands: ${Object.keys(tours).length}`);
  console.log(`Future tour bands in display window: ${futureTourBands}`);
  console.log(`Future tour stops in display window: ${futureTourStops}`);

  if (errors.length) {
    console.error(errors.map((error) => `- ${error}`).join("\n"));
    process.exitCode = 1;
  }
}

main();
