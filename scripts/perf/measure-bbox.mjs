// bbox ile tesis yükleme (ADR-0016) öncesi/sonrası: istek başına dönen kayıt, eksik veri (hasMore), boyut ve süre.
// Kullanım: node scripts/perf/measure-bbox.mjs --base http://localhost:5080 --runs 30 [--out dosya.json]
// Kutular uygulamanın gerçek mantığıyla hesaplanır: 1366×820 px görünüm, her yönde %50 pay (BBOX_PADDING_RATIO).
// Yalnız okuma istekleri gönderir; Node yerleşikleri.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const base = arg('--base', 'http://localhost:5080');
const runs = Number(arg('--runs', '30'));
const out = arg('--out');

// Web Mercator: zoom z'de 256·2^z piksel = 360° boylam; enlem için Mercator y dönüşümü.
function viewBbox([lon, lat], zoom, width = 1366, height = 820) {
  const world = 256 * 2 ** zoom;
  const x = ((lon + 180) / 360) * world;
  const y = ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * world;
  const toLon = (px) => (px / world) * 360 - 180;
  const toLat = (py) => (Math.atan(Math.sinh(Math.PI * (1 - (2 * py) / world))) * 180) / Math.PI;
  return [toLon(x - width / 2), toLat(y + height / 2), toLon(x + width / 2), toLat(y - height / 2)];
}
const expand = ([a, b, c, d], r = 0.5) => {
  const dx = (c - a) * r, dy = (d - b) * r;
  const round = (v) => Math.round(v * 1e5) / 1e5;
  return [round(Math.max(-180, a - dx)), round(Math.max(-90, b - dy)), round(Math.min(180, c + dx)), round(Math.min(90, d + dy))];
};

const center = [29.06, 40.19]; // Bursa merkezi (uygulamanın açılış merkezi)
const scenarios = [
  { name: 'ÖNCE: tüm tesisler tek istekte (limit=2000)', path: '/api/facilities?limit=2000' },
  ...[8, 11, 13, 15].map((z) => ({
    name: `SONRA: bbox, zoom ${z}${z === 8 ? ' (açılış görünümü)' : ''}`,
    path: `/api/facilities?bbox=${expand(viewBbox(center, z)).join(',')}&limit=2000`,
  })),
];

async function call(path) {
  const t0 = performance.now();
  const r = await fetch(base + path);
  const buf = Buffer.from(await r.arrayBuffer());
  const ms = performance.now() - t0;
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return { ms, buf };
}
const pct = (s, p) => s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)];

const total = (await (await fetch(base + '/api/layers')).json()).find((l) => l.id === 'facilities').featureCount;
const results = [];
for (const s of scenarios) {
  const { buf } = await call(s.path);
  const body = JSON.parse(buf.toString('utf8'));
  for (let i = 0; i < 3; i++) await call(s.path);
  const times = [];
  for (let i = 0; i < runs; i++) times.push((await call(s.path)).ms);
  times.sort((a, b) => a - b);
  results.push({ name: s.name, path: s.path, returned: body.meta.returned, hasMore: body.meta.hasMore, bytes: buf.length, gzipBytes: gzipSync(buf).length, p50: pct(times, 50), p95: pct(times, 95) });
}

console.log(`base=${base} runs=${runs} toplam tesis=${total}`);
console.log('| Senaryo | Dönen tesis | Eksik (hasMore) | Yanıt KB (gzip KB) | p50 (ms) | p95 (ms) |');
console.log('|---|---|---|---|---|---|');
for (const r of results) {
  console.log(`| ${r.name} | ${r.returned} | ${r.hasMore ? 'evet' : 'hayır'} | ${(r.bytes / 1024).toFixed(1)} (${(r.gzipBytes / 1024).toFixed(1)}) | ${r.p50.toFixed(1)} | ${r.p95.toFixed(1)} |`);
}
if (out) writeFileSync(out, JSON.stringify({ base, runs, totalFacilities: total, measuredAt: new Date().toISOString(), results }, null, 2));
