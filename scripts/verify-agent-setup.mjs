#!/usr/bin/env node
// Faz 0 Claude Code altyapısının statik doğrulaması.
// scripts/agent-setup.manifest.json'daki dosyaları ve .claude altındaki tüm agent/skill/rule dosyalarını denetler.
// Runtime keşfi (Claude'un dosyaları gerçekten yüklemesi) bu script'in kapsamı dışındadır; PROGRESS.md'de ayrıca kaydedilir.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyClaudeFile, checkClaudeMarkdown, splitFrontmatter, parseYaml, yamlAvailable, yamlUnavailableReason } from './lib/frontmatter.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const toPosix = (p) => p.split(path.sep).join('/');
const results = []; // { file, level: 'error'|'warn'|'info', msg }
const add = (file, level, msg) => results.push({ file, level, msg });

// Kurulu Claude Code sürümünün hook referansındaki olay adları.
const HOOK_EVENTS = new Set([
  'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'Notification', 'UserPromptSubmit', 'Stop', 'SubagentStart',
  'SubagentStop', 'PreCompact', 'SessionStart', 'SessionEnd', 'PermissionRequest',
]);
// Rule glob'larının işaret edebileceği proje kökü dizinleri (mimari plan, CLAUDE.md).
const PLANNED_TOP_DIRS = new Set(['backend', 'frontend', 'scripts', 'data', 'docs', '.github']);

function readUtf8(rel) {
  const buf = fs.readFileSync(path.join(root, rel));
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  return { text: text.charCodeAt(0) === 0xfeff ? text.slice(1) : text, bom: text.charCodeAt(0) === 0xfeff, size: buf.length };
}

function listClaudeMarkdown() {
  const found = [];
  const agentsDir = path.join(root, '.claude', 'agents');
  if (fs.existsSync(agentsDir)) for (const f of fs.readdirSync(agentsDir)) if (f.endsWith('.md')) found.push(`.claude/agents/${f}`);
  const skillsDir = path.join(root, '.claude', 'skills');
  if (fs.existsSync(skillsDir)) for (const d of fs.readdirSync(skillsDir)) if (fs.existsSync(path.join(skillsDir, d, 'SKILL.md'))) found.push(`.claude/skills/${d}/SKILL.md`);
  const rulesDir = path.join(root, '.claude', 'rules');
  if (fs.existsSync(rulesDir)) for (const f of fs.readdirSync(rulesDir)) if (f.endsWith('.md')) found.push(`.claude/rules/${f}`);
  return found;
}

// Göreli markdown bağlantıları ve "planlanan" olarak işaretlenmemiş komut referansları.
function checkReferences(rel, text, pkgScripts) {
  const dir = path.dirname(path.join(root, rel));
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1].split('#')[0];
    if (!target || /^[a-z]+:/i.test(target)) continue;
    if (!fs.existsSync(path.resolve(dir, decodeURIComponent(target)))) add(rel, 'error', `kırık göreli bağlantı: ${m[1]}`);
  }
  for (const line of text.split('\n')) {
    if (/planlanan/i.test(line)) continue;
    for (const m of line.matchAll(/node (scripts\/[\w./-]+\.mjs)/g)) {
      if (!fs.existsSync(path.join(root, m[1]))) add(rel, 'error', `var olmayan script'e referans: ${m[1]}`);
    }
    for (const m of line.matchAll(/npm run ([\w:-]+)/g)) {
      if (!pkgScripts.has(m[1])) add(rel, 'error', `kök package.json'da tanımsız script: npm run ${m[1]} (henüz yoksa satırı 'planlanan' diye işaretle)`);
    }
  }
}

function checkRuleGlobs(rel, data) {
  if (!data?.paths) {
    add(rel, 'info', 'paths yok: kural her oturumda koşulsuz yüklenir');
    return;
  }
  for (const glob of data.paths) {
    if (glob.includes('\\') || glob.startsWith('/') || glob.startsWith('./')) {
      add(rel, 'error', `glob proje köküne göre '/' ayraçlı olmalı: ${glob}`);
      continue;
    }
    const top = glob.split('/')[0];
    if (!PLANNED_TOP_DIRS.has(top)) add(rel, 'error', `glob planlanmış bir proje dizinine işaret etmiyor: ${glob}`);
    let matches = [];
    try {
      matches = fs.globSync(glob, { cwd: root, exclude: (p) => /(^|[\\/])(node_modules|bin|obj|dist)$/.test(p) });
    } catch (err) {
      add(rel, 'error', `glob değerlendirilemedi: ${glob} (${err.message})`);
      continue;
    }
    add(rel, 'info', `${glob} → ${matches.length} eşleşme${matches.length ? '' : ' (dizin ilgili fazda oluşacak)'}`);
  }
}

function checkSettings(rel, text) {
  let settings;
  try {
    settings = JSON.parse(text);
  } catch (err) {
    add(rel, 'error', `JSON parse hatası: ${err.message}`);
    return;
  }
  for (const key of ['allow', 'deny', 'ask']) {
    const list = settings.permissions?.[key];
    if (list !== undefined && !(Array.isArray(list) && list.every((x) => typeof x === 'string'))) add(rel, 'error', `permissions.${key} metin dizisi olmalı`);
  }
  for (const [event, groups] of Object.entries(settings.hooks ?? {})) {
    if (!HOOK_EVENTS.has(event)) add(rel, 'error', `bilinmeyen hook olayı: ${event}`);
    if (!Array.isArray(groups)) {
      add(rel, 'error', `hooks.${event} dizi olmalı`);
      continue;
    }
    for (const g of groups) {
      if (g.matcher !== undefined && typeof g.matcher !== 'string') add(rel, 'error', `hooks.${event} matcher metin olmalı`);
      for (const h of g.hooks ?? []) {
        if (h.type !== 'command' || typeof h.command !== 'string') add(rel, 'error', `hooks.${event}: type 'command' ve command metni gerekli`);
        if (h.timeout !== undefined && !(Number.isFinite(h.timeout) && h.timeout > 0)) add(rel, 'error', `hooks.${event}: timeout pozitif sayı olmalı`);
        const script = /scripts\/[\w./-]+\.mjs/.exec(h.command ?? '')?.[0];
        if (script && !fs.existsSync(path.join(root, script))) add(rel, 'error', `hook script'i yok: ${script}`);
        else if (script) add(rel, 'info', `${event}[${g.matcher ?? '*'}] → ${script}`);
      }
    }
  }
}

function main() {
  if (!yamlAvailable()) {
    console.error(yamlUnavailableReason());
    process.exit(1);
  }
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'scripts', 'agent-setup.manifest.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  const pkgScripts = new Set(Object.keys(pkg.scripts ?? {}));

  const entries = new Map(manifest.files.map((e) => [e.path, e]));
  for (const extra of listClaudeMarkdown()) {
    if (!entries.has(extra)) {
      entries.set(extra, { path: extra, kind: classifyClaudeFile(extra) });
      add(extra, 'warn', 'manifestte yok (denetlendi; gerekiyorsa manifest ve FILE-MANIFEST.md güncellenmeli)');
    }
  }

  const names = { agent: new Map(), skill: new Map() };
  for (const entry of entries.values()) {
    const rel = entry.path;
    if (!fs.existsSync(path.join(root, rel))) {
      add(rel, 'error', 'dosya yok');
      continue;
    }
    let file;
    try {
      file = readUtf8(rel);
    } catch {
      add(rel, 'error', 'geçerli UTF-8 değil');
      continue;
    }
    if (file.size === 0) {
      add(rel, 'error', 'boş dosya');
      continue;
    }
    if (entry.minBytes && file.size < entry.minBytes) add(rel, 'error', `içerik beklenenden kısa (${file.size} < ${entry.minBytes} bayt)`);

    switch (entry.kind) {
      case 'agent':
      case 'skill':
      case 'rule': {
        const { errors, data } = checkClaudeMarkdown(entry.kind, rel, file.text);
        errors.forEach((e) => add(rel, 'error', e));
        if (data?.name && names[entry.kind]) {
          const prev = names[entry.kind].get(data.name);
          if (prev) add(rel, 'error', `${entry.kind} adı tekrar ediyor: ${data.name} (${prev})`);
          names[entry.kind].set(data.name, rel);
        }
        for (const [k, v] of Object.entries(entry.requireFrontmatter ?? {})) {
          if (data?.[k] !== v) add(rel, 'error', `frontmatter '${k}: ${v}' korunmalı (bulunan: ${data?.[k]})`);
        }
        if (entry.kind === 'rule') checkRuleGlobs(rel, data);
        // Kurulu (üçüncü taraf) skill'lerin içeriği bu projenin komut kurallarına göre denetlenmez.
        if (!entry.preexisting) checkReferences(rel, file.text, pkgScripts);
        break;
      }
      case 'settings':
        if (file.bom) add(rel, 'error', 'BOM içeriyor');
        checkSettings(rel, file.text);
        break;
      case 'json':
        try {
          JSON.parse(file.text);
        } catch (err) {
          add(rel, 'error', `JSON parse hatası: ${err.message}`);
        }
        break;
      case 'markdown': {
        const fm = splitFrontmatter(file.text);
        if (fm.hasFrontmatter) {
          try {
            parseYaml(fm.raw);
          } catch (err) {
            add(rel, 'error', `frontmatter YAML hatası: ${err.message.split('\n')[0]}`);
          }
        }
        if (!entry.preexisting) checkReferences(rel, file.text, pkgScripts);
        if (/sonra doldurulacak|TODO: doldur/i.test(file.text)) add(rel, 'error', 'yer tutucu metin içeriyor');
        break;
      }
      case 'script':
        // Sözdizimi hook ve npm test:hooks tarafından kontrol edilir; burada varlık ve UTF-8 yeterli.
        break;
      default:
        add(rel, 'error', `bilinmeyen manifest türü: ${entry.kind}`);
    }
    if (!results.some((r) => r.file === rel && r.level === 'error')) add(rel, 'ok', entry.preexisting ? 'geçti (önceden kurulu, korundu)' : 'geçti');
  }

  const verbose = process.argv.includes('--verbose');
  const order = { error: 0, warn: 1, info: 2, ok: 3 };
  for (const r of results.sort((a, b) => order[a.level] - order[b.level] || a.file.localeCompare(b.file))) {
    if (r.level === 'info' && !verbose) continue;
    console.log(`${r.level.toUpperCase().padEnd(5)} ${toPosix(r.file)}: ${r.msg}`);
  }
  const errors = results.filter((r) => r.level === 'error').length;
  const warns = results.filter((r) => r.level === 'warn').length;
  console.log(`\nverify-agent-setup: ${entries.size} dosya, ${errors} hata, ${warns} uyarı`);
  process.exit(errors ? 1 : 0);
}

main();
