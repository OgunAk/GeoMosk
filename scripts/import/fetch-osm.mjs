#!/usr/bin/env node
// Overpass API'den Bursa ilçe ve sağlık tesisi verisini indirir; değiştirilmemiş ham snapshot yazar.
//   node scripts/import/fetch-osm.mjs [--out data/raw/osm] [--endpoint <url>]
// Çıktı: <out>/<snapshotId>/{districts,facilities}.json + manifest.json (sorgu, zaman, osm_base, sha256, sayı)
// ve data/raw/osm-bursa.manifest.json (son snapshot'ın Git'e girebilen kopyası).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { QUERIES } from './overpass-queries.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DEFAULT_ENDPOINT = 'https://overpass-api.de/api/interpreter';
const USER_AGENT = 'GeoMosk-import/0.2 (Web GIS student project)';
const MAX_ATTEMPTS = 5;

function arg(name, fallback) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function runQuery(endpoint, name, query) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'User-Agent': USER_AGENT, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(240_000),
      });
      const text = await res.text();
      // Overpass yoğunlukta 429/502/504 döner; JSON yerine HTML/metin gelebilir.
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 120).replace(/\s+/g, ' ')}`);
      const json = JSON.parse(text);
      if (json.remark && /error|timed out|runtime/i.test(json.remark)) throw new Error(`Overpass uyarısı: ${json.remark}`);
      return { text, json };
    } catch (err) {
      if (attempt === MAX_ATTEMPTS) throw new Error(`${name} sorgusu ${MAX_ATTEMPTS} denemede başarısız: ${err.message}`);
      const wait = 10_000 * attempt;
      console.warn(`${name}: deneme ${attempt} başarısız (${err.message}); ${wait / 1000} sn sonra tekrar`);
      await sleep(wait);
    }
  }
}

async function main() {
  const endpoint = arg('--endpoint', DEFAULT_ENDPOINT);
  const outRoot = path.resolve(root, arg('--out', 'data/raw/osm'));
  const fetchedAt = new Date().toISOString();
  const snapshotId = fetchedAt.replace(/[:.]/g, '-');
  const dir = path.join(outRoot, snapshotId);
  fs.mkdirSync(dir, { recursive: true });

  const manifest = { source: 'OpenStreetMap via Overpass API', endpoint, license: 'ODbL-1.0', attribution: '© OpenStreetMap contributors', snapshotId, fetchedAt, files: {} };
  for (const [name, query] of Object.entries(QUERIES)) {
    console.log(`${name}: indiriliyor…`);
    const { text, json } = await runQuery(endpoint, name, query);
    const file = `${name}.json`;
    fs.writeFileSync(path.join(dir, file), text);
    const counts = {};
    for (const e of json.elements) counts[e.type] = (counts[e.type] ?? 0) + 1;
    manifest.files[name] = {
      file,
      query,
      osmBase: json.osm3s?.timestamp_osm_base ?? null,
      sha256: crypto.createHash('sha256').update(text).digest('hex'),
      bytes: Buffer.byteLength(text),
      elements: json.elements.length,
      byType: counts,
    };
    console.log(`${name}: ${json.elements.length} öğe ${JSON.stringify(counts)}, osm_base ${manifest.files[name].osmBase}`);
    await sleep(5_000); // Overpass adil kullanım: ardışık sorgular arasında bekle
  }
  const manifestJson = `${JSON.stringify(manifest, null, 2)}\n`;
  fs.writeFileSync(path.join(dir, 'manifest.json'), manifestJson);
  fs.writeFileSync(path.join(root, 'data', 'raw', 'osm-bursa.manifest.json'), manifestJson);
  console.log(`Snapshot: ${path.relative(root, dir)}`);
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
