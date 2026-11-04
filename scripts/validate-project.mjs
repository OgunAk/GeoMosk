#!/usr/bin/env node
// GeoScope faz kabul kapısı.
//   node scripts/validate-project.mjs --phase <0..8>
//   node scripts/validate-project.mjs --full        (= --phase 8)
// Çıkış: 0 geçti, 1 başarısız kontrol, 3 faz henüz uygulanmadı (gerekli dosya yok).
// Komutlar gerçekten çalıştırılır; çalıştırılamayan kontrol "geçti" sayılmaz.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWin = process.platform === 'win32';
const npm = isWin ? 'npm.cmd' : 'npm';

const REQ_COLUMNS = ['ID', 'Kaynak/sayfa/başlık', 'Gereksinim', 'Sınıf', 'Teknik karşılık', 'Faz', 'Kabul testi', 'Kanıt/dosya', 'Durum'];
const REQ_STATUSES = new Set(['bekliyor', 'devam ediyor', 'doğrulandı', 'engelli', 'kapsam dışı']);

// Her faz bir öncekinin dosya ve komutlarını devralır.
const PHASES = [
  {
    phase: 0,
    title: 'Analiz ve ajan altyapısı',
    files: ['CLAUDE.md', '.claude/settings.json', 'docs/REQUIREMENTS.md', 'docs/PROGRESS.md', 'scripts/verify-agent-setup.mjs', 'scripts/hooks/validate-changed-files.mjs'],
    commands: [
      { name: 'verify-agent-setup', cmd: process.execPath, args: ['scripts/verify-agent-setup.mjs'] },
      { name: 'hook fixture testleri', cmd: npm, args: ['run', 'test:hooks', '--silent'] },
    ],
    checks: [checkRequirementsMatrix],
  },
  {
    phase: 1,
    title: 'Çalışan iskelet',
    files: ['global.json', 'docker-compose.yml', '.env.example', 'frontend/package.json', 'frontend/package-lock.json', '.github/workflows'],
    anyOf: [['backend/GeoScope.sln', 'backend/GeoScope.slnx']],
    commands: [
      { name: 'dotnet build', cmd: 'dotnet', args: ['build', 'backend', '--nologo', '-v', 'q'] },
      { name: 'dotnet test', cmd: 'dotnet', args: ['test', 'backend', '--nologo', '-v', 'q'] },
      { name: 'frontend typecheck', cmd: npm, args: ['--prefix', 'frontend', 'run', 'typecheck'] },
      { name: 'frontend lint', cmd: npm, args: ['--prefix', 'frontend', 'run', 'lint'] },
      { name: 'frontend test', cmd: npm, args: ['--prefix', 'frontend', 'run', 'test'] },
      { name: 'frontend build', cmd: npm, args: ['--prefix', 'frontend', 'run', 'build'] },
      { name: 'docker compose config', cmd: 'docker', args: ['compose', 'config', '--quiet'] },
    ],
  },
  {
    phase: 2,
    title: 'Gerçek veri dikey dilimi',
    files: [
      'docs/DATA-SOURCES.md', 'docs/DATABASE.md', 'docs/API-CONTRACT.md',
      'scripts/import/fetch-osm.mjs', 'scripts/import/load-osm.mjs', 'data/raw/osm-bursa.manifest.json',
      'data/test-fixtures/osm-mini/v1/manifest.json', 'backend/GeoScope.Infrastructure/Persistence/Migrations',
      'docker/db/sql/app-role.sql', 'frontend/src/features/map/MapView.tsx',
    ],
    checks: [checkSampleSnapshot],
  },
  {
    phase: 3,
    title: 'Katman, arama ve API',
    files: [
      'frontend/src/features/search/SearchPanel.tsx', 'frontend/src/features/details/FeatureEditor.tsx',
      'frontend/src/features/layers/LayerPanel.tsx', 'frontend/tests/e2e/map.spec.ts', 'frontend/playwright.config.ts',
    ],
    // Çalışan Compose ortamı + import edilmiş veri gerekir (bkz. frontend/playwright.config.ts).
    commands: [{ name: 'frontend e2e (Playwright, compose)', cmd: npm, args: ['--prefix', 'frontend', 'run', 'e2e'] }],
  },
  { phase: 4, title: 'Çizim ve CRUD', files: ['frontend/src/features/drawing', 'docs/DEVELOPER-REVIEW.md'] },
  { phase: 5, title: 'Üç MVP analizi', files: ['frontend/src/features/analysis', 'docs/TEST-PLAN.md'] },
  { phase: 6, title: 'Güçlü teslim analizleri', files: [] },
  { phase: 7, title: 'Sağlamlaştırma', files: [] },
  {
    phase: 8,
    title: 'Teslim',
    files: ['README.md', 'docs/DELIVERY-CHECKLIST.md', 'docs/FILE-MANIFEST.md'],
  },
];

function parseArgs(argv) {
  if (argv.includes('--full')) return 8;
  const i = argv.indexOf('--phase');
  const n = i >= 0 ? Number(argv[i + 1]) : NaN;
  if (!Number.isInteger(n) || n < 0 || n > 8) {
    console.error('Kullanım: node scripts/validate-project.mjs --phase <0..8> | --full');
    process.exit(2);
  }
  return n;
}

function run({ cmd, args }) {
  const started = Date.now();
  // Windows'ta .cmd dosyaları shell gerektirir; argümanlar sabit ve proje içi, kullanıcı girdisi içermez.
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8', shell: isWin && cmd.endsWith('.cmd'), timeout: 15 * 60_000 });
  const lines = `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n');
  // Hata satırları çıktının başında olabilir; önce onları, yoksa son satırları göster.
  const errorLines = lines.filter((l) => /^(ERROR|✖|not ok)|error/i.test(l.trim()));
  const tail = (errorLines.length ? errorLines.slice(0, 10) : lines.slice(-6)).join('\n');
  return { status: r.error ? `başlatılamadı (${r.error.code})` : r.status, ms: Date.now() - started, tail };
}

// Depodaki gerçek veri örneğinin checksum'ı manifestle uyuşmalı (import aynı kontrolü yapar).
export function checkSampleSnapshot() {
  const problems = [];
  const base = path.join(root, 'data', 'samples', 'osm-bursa');
  const ids = fs.existsSync(base) ? fs.readdirSync(base).filter((d) => fs.existsSync(path.join(base, d, 'manifest.json'))) : [];
  if (!ids.length) return ['data/samples/osm-bursa altında manifest\'li snapshot yok'];
  for (const id of ids) {
    const manifest = JSON.parse(fs.readFileSync(path.join(base, id, 'manifest.json'), 'utf8'));
    if (manifest.synthetic) problems.push(`${id}: samples altındaki veri sentetik olamaz`);
    for (const [name, meta] of Object.entries(manifest.files ?? {})) {
      const sha = crypto.createHash('sha256').update(fs.readFileSync(path.join(base, id, meta.file))).digest('hex');
      if (sha !== meta.sha256) problems.push(`${id}/${name}: checksum uyuşmuyor`);
    }
  }
  return problems;
}

export function checkRequirementsMatrix() {
  const problems = [];
  const file = path.join(root, 'docs', 'REQUIREMENTS.md');
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const headerIdx = lines.findIndex((l) => l.startsWith('| ID |'));
  if (headerIdx < 0) return ['REQUIREMENTS.md: matris başlığı (| ID | ...) bulunamadı'];
  const cols = lines[headerIdx].split('|').slice(1, -1).map((c) => c.trim());
  if (cols.join('|') !== REQ_COLUMNS.join('|')) problems.push(`REQUIREMENTS.md: sütunlar beklenenden farklı: ${cols.join(' | ')}`);
  let rows = 0;
  const ids = new Set();
  for (const line of lines.slice(headerIdx + 2)) {
    if (!line.startsWith('|')) break;
    const cells = line.split('|').slice(1, -1).map((c) => c.trim());
    rows++;
    const [id, , , , , , , evidence, status] = cells;
    if (cells.length !== REQ_COLUMNS.length) problems.push(`${id}: ${cells.length} hücre (beklenen ${REQ_COLUMNS.length})`);
    if (ids.has(id)) problems.push(`${id}: ID tekrar ediyor`);
    ids.add(id);
    if (!REQ_STATUSES.has(status)) problems.push(`${id}: geçersiz durum '${status}'`);
    if (status === 'doğrulandı' && (!evidence || evidence === '—' || evidence === '-')) problems.push(`${id}: kanıtsız 'doğrulandı'`);
  }
  if (rows < 33) problems.push(`REQUIREMENTS.md: ${rows} satır; PDF'den aktarılan 33 satırın tamamı bekleniyor`);
  return problems;
}

function main() {
  const target = parseArgs(process.argv.slice(2));
  let failed = 0;
  let missing = 0;
  for (const p of PHASES.filter((x) => x.phase <= target)) {
    console.log(`\n== Faz ${p.phase} — ${p.title}`);
    const absent = p.files.filter((f) => !fs.existsSync(path.join(root, f)));
    for (const group of p.anyOf ?? []) if (!group.some((f) => fs.existsSync(path.join(root, f)))) absent.push(group.join(' | '));
    for (const f of absent) console.log(`  EKSİK  ${f}`);
    if (absent.length) {
      missing += absent.length;
      console.log('  ATLANDI komutlar: faz dosyaları henüz yok');
      continue;
    }
    for (const c of p.commands ?? []) {
      const r = run(c);
      const ok = r.status === 0;
      if (!ok) failed++;
      console.log(`  ${ok ? 'GEÇTİ ' : 'HATA  '} ${c.name} (exit ${r.status}, ${r.ms} ms)`);
      if (!ok && r.tail) console.log(r.tail.replace(/^/gm, '         '));
    }
    for (const check of p.checks ?? []) {
      const problems = check();
      if (problems.length) failed++;
      console.log(`  ${problems.length ? 'HATA  ' : 'GEÇTİ '} ${check.name}${problems.length ? '' : ''}`);
      problems.forEach((x) => console.log(`         - ${x}`));
    }
  }
  const verdict = failed ? 'BAŞARISIZ' : missing ? 'UYGULANMADI' : 'GEÇTİ';
  console.log(`\nvalidate-project --phase ${target}: ${verdict} (${failed} başarısız kontrol, ${missing} eksik dosya)`);
  process.exit(failed ? 1 : missing ? 3 : 0);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) main();
