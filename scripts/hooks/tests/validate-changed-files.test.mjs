// validate-changed-files.mjs için fixture testleri: gerçek alt süreç + stdin ile hook davranışı.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const scriptsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const hook = path.join(scriptsDir, 'hooks', 'validate-changed-files.mjs');
let root;

const validAgent = `---
name: sample-agent
description: Fixture ajanı; hook frontmatter doğrulamasının geçerli girdiyi kabul ettiğini test eder.
---

# Örnek ajan

${'Bu gövde metni, içerik uzunluk kontrolünü geçmek için yeterince uzun tutulmuştur. '.repeat(4)}
`;

function write(rel, content) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, content);
  return abs;
}

function runHook(payload, { env = {}, script = hook, raw } = {}) {
  return spawnSync(process.execPath, [script], {
    input: raw ?? JSON.stringify(payload),
    encoding: 'utf8',
    env: { ...process.env, CLAUDE_PROJECT_DIR: root, ...env },
    timeout: 20_000,
  });
}

const edit = (filePath) => ({ hook_event_name: 'PostToolUse', tool_name: 'Edit', tool_input: { file_path: filePath }, cwd: root });

before(() => {
  // Boşluklu kök dizin Windows/Linux yol işleme davranışını sınar.
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'geo scope hook '));
});
after(() => fs.rmSync(root, { recursive: true, force: true }));

test('geçerli JSON kabul edilir', () => {
  const r = runHook(edit(write('a.json', '{"ok": true}')));
  assert.equal(r.status, 0, r.stderr);
});

test('bozuk JSON exit 2 ve açıklama üretir', () => {
  const r = runHook(edit(write('bad.json', '{"ok": ')));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /JSON parse hatası/);
});

test('tsconfig JSONC yorum ve sondaki virgülle kabul edilir', () => {
  const jsonc = '{\n  /* Bundler */\n  "compilerOptions": { "strict": true, // yorum\n  "paths": {"@/*": ["src/*"]}, },\n  "x": "http://a//b"\n}\n';
  const r = runHook(edit(write('frontend/tsconfig.app.json', jsonc)));
  assert.equal(r.status, 0, r.stderr);
});

test('JSONC olmayan JSON dosyasında yorum reddedilir', () => {
  const r = runHook(edit(write('frontend/package.json', '{ // yorum\n "a": 1 }')));
  assert.equal(r.status, 2);
});

test('JSONC içinde gerçek sözdizimi hatası yakalanır', () => {
  const r = runHook(edit(write('tsconfig.json', '{ /* c */ "a": }')));
  assert.equal(r.status, 2);
});

test('BOM ile başlayan JSON reddedilir', () => {
  const r = runHook(edit(write('bom.json', '﻿{}')));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /BOM/);
});

test('bozuk hook stdin girdisi işi engellemez', () => {
  const r = runHook(null, { raw: 'not json{' });
  assert.equal(r.status, 0);
  assert.match(r.stderr, /JSON değil/);
});

test('proje kökü dışındaki yol atlanır', () => {
  const outside = path.join(os.tmpdir(), 'geoscope-outside.json');
  fs.writeFileSync(outside, '{bad');
  try {
    const r = runHook(edit(outside));
    assert.equal(r.status, 0, r.stderr);
  } finally {
    fs.rmSync(outside, { force: true });
  }
});

test('../ ile kökten kaçış atlanır', () => {
  const r = runHook(edit('../../etc/passwd'));
  assert.equal(r.status, 0);
});

test('ilgisiz uzantı ve yoksayılan dizin atlanır', () => {
  assert.equal(runHook(edit(write('img.png', 'not really png {'))).status, 0);
  assert.equal(runHook(edit(write('node_modules/x/bad.json', '{'))).status, 0);
});

test('boşluklu yolda geçerli ajan kabul edilir', () => {
  const r = runHook(edit(write('.claude/agents/sample-agent.md', validAgent)));
  assert.equal(r.status, 0, r.stderr);
});

test('göreli Windows ayraçlı yol çözümlenir', () => {
  write('.claude/agents/sample-agent.md', validAgent);
  const r = runHook(edit('.claude\\agents\\sample-agent.md'.split('\\').join(path.sep)));
  assert.equal(r.status, 0, r.stderr);
});

test('ad uyuşmazlığı ve eksik description yakalanır', () => {
  const bad = validAgent.replace('name: sample-agent', 'name: other').replace(/description: .*\n/, '');
  const r = runHook(edit(write('.claude/agents/sample-agent.md', bad)));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /dosya\/dizin adıyla/);
  assert.match(r.stderr, /'description'/);
});

test('rule paths alanı dizi değilse reddedilir', () => {
  const r = runHook(edit(write('.claude/rules/x.md', `---\npaths: "backend/**"\n---\n${'kural '.repeat(60)}`)));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /'paths'/);
});

test('mjs sözdizimi hatası yakalanır', () => {
  const r = runHook(edit(write('scripts/broken.mjs', 'export const = ;')));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /node --check/);
});

test('özel anahtar içeriği reddedilir', () => {
  // Kalıp çalışma anında birleştirilir; bu test dosyası kendi hook'unu tetiklemesin.
  const marker = ['-----BEGIN', 'PRIVATE KEY-----'].join(' ');
  const r = runHook(edit(write('notes.md', `${marker}\nabc\n`)));
  assert.equal(r.status, 2);
});

test('geçersiz UTF-8 reddedilir', () => {
  const r = runHook(edit(write('latin.md', Buffer.from([0x47, 0xfe, 0xff, 0x0a]))));
  assert.equal(r.status, 2);
  assert.match(r.stderr, /UTF-8/);
});

test('node --check zaman aşımı uyarıya düşer, engellemez', () => {
  const r = runHook(edit(write('scripts/ok.mjs', 'export const a = 1;')), { env: { GEOSCOPE_HOOK_CHECK_TIMEOUT_MS: '1' } });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stderr, /zaman aşımı/);
});

test('yaml paketi eksikse frontmatter kontrolü uyarıyla atlanır', () => {
  // Script'leri node_modules erişimi olmayan bir kopyaya taşı.
  const isolated = fs.mkdtempSync(path.join(os.tmpdir(), 'geoscope-noyaml-'));
  try {
    fs.cpSync(path.join(scriptsDir, 'hooks', 'validate-changed-files.mjs'), path.join(isolated, 'hooks', 'validate-changed-files.mjs'));
    fs.cpSync(path.join(scriptsDir, 'lib'), path.join(isolated, 'lib'), { recursive: true });
    const r = runHook(edit(write('.claude/agents/sample-agent.md', validAgent)), { script: path.join(isolated, 'hooks', 'validate-changed-files.mjs') });
    assert.equal(r.status, 0, r.stderr);
    assert.match(r.stderr, /yaml paketi yüklenemedi/);
  } finally {
    fs.rmSync(isolated, { recursive: true, force: true });
  }
});

test('elle --file modu çalışır', () => {
  const abs = write('bad2.json', '[');
  const r = spawnSync(process.execPath, [hook, '--file', abs, '--root', root], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});
