// API gecikme ölçümü (Faz 7, Q03): her senaryo için soğuk ilk istek, sıralı p50/p95 ve eşzamanlı p50/p95, yanıt boyutu.
// Kullanım: node scripts/perf/measure-api.mjs --base http://localhost:5081 --runs 60 --concurrency 4 [--out dosya.json]
// Yalnız Node yerleşikleri; API'ye okuma ve analiz istekleri gönderir, veri yazmaz.
import { writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { performance } from 'node:perf_hooks';

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}
const base = arg('--base', 'http://localhost:5080');
const runs = Number(arg('--runs', '60'));
const concurrency = Number(arg('--concurrency', '4'));
const out = arg('--out');

async function call(s) {
  const t0 = performance.now();
  const response = await fetch(base + s.path, s.body
    ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s.body) }
    : undefined);
  const buffer = Buffer.from(await response.arrayBuffer());
  const ms = performance.now() - t0;
  if (!response.ok) throw new Error(`${s.name}: HTTP ${response.status} ${buffer.toString('utf8').slice(0, 200)}`);
  return { ms, bytes: buffer.length, gzip: gzipSync(buffer).length };
}

const pct = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1)];
const stats = (values) => {
  const s = [...values].sort((a, b) => a - b);
  return { p50: pct(s, 50), p95: pct(s, 95), max: s[s.length - 1] };
};

const json = async (path) => (await fetch(base + path)).json();
const nilufer = (await json('/api/districts?q=nilufer')).features[0].id;
const hospital = (await json('/api/facilities?q=%C3%A7ekirge%20devlet&limit=1')).features[0].id;

const scenarios = [
  { name: 'İlçeler (tümü, GeoJSON)', path: '/api/districts' },
  { name: 'Tesisler liste limit=2000', path: '/api/facilities?limit=2000' },
  { name: 'Tesisler bbox (Bursa merkez) limit=2000', path: '/api/facilities?bbox=29.0,40.15,29.12,40.24&limit=2000' },
  { name: 'Arama "eczane"', path: '/api/facilities?q=eczane&limit=50' },
  { name: 'Arama ilçe "nilufer"', path: '/api/districts?q=nilufer' },
  { name: 'A01 alan içinde (Nilüfer)', path: '/api/analysis/within', body: { sourceFeature: { layerId: 'districts', id: nilufer } } },
  { name: 'A02 tampon 2000 m (hastane)', path: '/api/analysis/buffer', body: { sourceFeature: { layerId: 'facilities', id: hospital }, radiusMeters: 2000 } },
  { name: 'A03 en yakın 10', path: '/api/analysis/nearest', body: { point: { type: 'Point', coordinates: [29.06, 40.19] }, n: 10 } },
  { name: 'A04 ölçüm (Nilüfer)', path: '/api/analysis/measure', body: { sourceFeature: { layerId: 'districts', id: nilufer } } },
  { name: 'A05 ilçe başına sayım', path: '/api/analysis/district-stats' },
];

const results = [];
for (const s of scenarios) {
  const cold = await call(s);
  for (let i = 0; i < 3; i++) await call(s);
  const sequential = [];
  for (let i = 0; i < runs; i++) sequential.push((await call(s)).ms);
  const parallel = [];
  await Promise.all(Array.from({ length: concurrency }, async () => {
    for (let i = 0; i < Math.ceil(runs / concurrency); i++) parallel.push((await call(s)).ms);
  }));
  results.push({ name: s.name, coldMs: cold.ms, bytes: cold.bytes, gzipBytes: cold.gzip, sequential: stats(sequential), concurrent: stats(parallel) });
}

const f = (x) => x.toFixed(1);
const kb = (b) => (b / 1024).toFixed(1);
console.log(`base=${base} runs=${runs} concurrency=${concurrency}`);
console.log('| Senaryo | Soğuk (ms) | p50 (ms) | p95 (ms) | p50 eşz. (ms) | p95 eşz. (ms) | Yanıt KB (gzip) |');
console.log('|---|---|---|---|---|---|---|');
for (const r of results) {
  console.log(`| ${r.name} | ${f(r.coldMs)} | ${f(r.sequential.p50)} | ${f(r.sequential.p95)} | ${f(r.concurrent.p50)} | ${f(r.concurrent.p95)} | ${kb(r.bytes)} (${kb(r.gzipBytes)}) |`);
}
if (out) writeFileSync(out, JSON.stringify({ base, runs, concurrency, measuredAt: new Date().toISOString(), results }, null, 2));
