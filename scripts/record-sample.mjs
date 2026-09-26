// Records one real run of the pipeline as the "Try a sample sighting" fixture.
// The photo and every image the run references are saved under public/sample/
// and the fixture points at those copies, so the sample works with wifi off.
//
//   npm run dev            (in another terminal)
//   node scripts/record-sample.mjs path/to/billboard.jpg [http://localhost:3000]
//
// The photo should already be a JPEG of about 1568px on the long edge, like
// the browser would upload.

import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const [photoPath, base = "http://localhost:3000"] = process.argv.slice(2);
if (!photoPath) {
  console.error("usage: node scripts/record-sample.mjs <photo.jpg> [baseUrl]");
  process.exit(1);
}

const ASSET_DIR = "public/sample";
const FIXTURE = "fixtures/sample.json";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

const photo = await readFile(photoPath);
const form = new FormData();
form.append("image", new Blob([photo], { type: "image/jpeg" }), "sighting.jpg");

console.log(`Decoding ${photoPath} via ${base}/api/decode …`);
const started = Date.now();
const res = await fetch(`${base}/api/decode`, { method: "POST", body: form });
if (!res.ok || !res.body) {
  console.error(`Request failed: ${res.status} ${await res.text()}`);
  process.exit(1);
}

const events = [];
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of res.body) {
  buffer += decoder.decode(chunk, { stream: true });
  let cut;
  while ((cut = buffer.indexOf("\n\n")) !== -1) {
    const frame = buffer.slice(0, cut);
    buffer = buffer.slice(cut + 2);
    const event = frame.match(/^event: (.+)$/m)?.[1];
    const data = frame.match(/^data: (.+)$/m)?.[1];
    if (!event || !data) continue;
    const t = Date.now() - started;
    events.push({ t, event, data: JSON.parse(data) });
    console.log(`  +${(t / 1000).toFixed(1)}s ${event}`);
  }
}

const seen = new Set(events.map((e) => e.event));
const problems = [
  ...["spotter", "explainer", "researcher", "done"].filter((e) => !seen.has(e)).map((e) => `no ${e} event`),
  ...events.filter((e) => e.event === "error" || e.event === "not_a_bird").map((e) => `${e.event}: ${JSON.stringify(e.data)}`),
];
if (problems.length) {
  console.error("Not recording this run:\n  " + problems.join("\n  "));
  process.exit(1);
}

await rm(ASSET_DIR, { recursive: true, force: true });
await mkdir(ASSET_DIR, { recursive: true });
await writeFile(path.join(ASSET_DIR, "sighting.jpg"), photo);

const EXT = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif", "image/svg+xml": "svg", "image/x-icon": "ico", "image/vnd.microsoft.icon": "ico", "image/avif": "avif" };
const saved = new Map();

async function localize(url, name) {
  if (!url) return null;
  if (saved.has(url)) return saved.get(url);
  let local = null;
  try {
    // Microlink renders screenshots on demand and can time out on a cold start.
    let r;
    for (let attempt = 1; attempt <= 3; attempt++) {
      r = await fetch(url, { headers: { "user-agent": UA }, redirect: "follow", signal: AbortSignal.timeout(45_000) });
      if (r.ok || attempt === 3 || r.status < 500 && r.status !== 408) break;
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const type = (r.headers.get("content-type") ?? "").split(";")[0].trim();
    const ext = EXT[type] ?? path.extname(new URL(url).pathname).slice(1) ?? "img";
    const file = `${name}.${ext}`;
    await writeFile(path.join(ASSET_DIR, file), Buffer.from(await r.arrayBuffer()));
    local = `/sample/${file}`;
    console.log(`  saved ${name} → ${local}`);
  } catch (err) {
    console.warn(`  couldn't save ${name} (${url}): ${err.message}`);
  }
  saved.set(url, local);
  return local;
}

for (const e of events.filter((e) => e.event === "photographer")) {
  e.data.hero_image_url = await localize(e.data.hero_image_url, "hero");
  e.data.logo_url = await localize(e.data.logo_url, "logo");
  e.data.screenshot_url = await localize(e.data.screenshot_url, "screenshot");
}

await mkdir(path.dirname(FIXTURE), { recursive: true });
await writeFile(
  FIXTURE,
  JSON.stringify({ recorded_at: new Date().toISOString(), photo: "/sample/sighting.jpg", events }, null, 2) + "\n",
);
console.log(`Wrote ${FIXTURE} (${events.length} events).`);
