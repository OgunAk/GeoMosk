#!/usr/bin/env node
// PostToolUse (Write|Edit) hafif doğrulayıcı.
// Yalnızca değişen tek dosyayı kontrol eder; build/test, container veya ağ çağrısı yapmaz.
// Hiçbir dosyayı değiştirmez. Asıl kalite kapısı validate-project.mjs ve CI'dır.
//
// Kullanım:
//   Hook:  stdin'e Claude Code PostToolUse JSON'u gelir.
//   Elle:  node scripts/hooks/validate-changed-files.mjs --file <yol> [--root <dizin>]
// Çıkış kodları: 0 = geçti/atlandı, 2 = doğrulama hatası (stderr Claude'a iletilir).
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { classifyClaudeFile, checkClaudeMarkdown, parseYaml, yamlAvailable, yamlUnavailableReason } from '../lib/frontmatter.mjs';

const MAX_BYTES = 2 * 1024 * 1024;
const NODE_CHECK_TIMEOUT_MS = Number(process.env.GEOMOSK_HOOK_CHECK_TIMEOUT_MS) || 10_000;
const SKIP_DIRS = new Set(['node_modules', 'bin', 'obj', 'dist', '.git', '.playwright', '.playwright-cli']);
const TEXT_EXT = new Set(['.md', '.json', '.mjs', '.js', '.cjs', '.ts', '.tsx', '.cs', '.csproj', '.sql', '.yml', '.yaml', '.css', '.html', '.env', '.example', '.txt']);
const PRIVATE_KEY_RE = /-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----/;

// Yorum ve sondaki virgüle izin veren (JSONC) bilinen yapılandırma dosyaları.
function isJsonc(rel) {
  const p = rel.split(path.sep).join('/');
  const base = path.basename(p);
  return /^[tj]sconfig(\..+)?\.json$/.test(base) || p.startsWith('.vscode/') || p.includes('/.vscode/') || base === '.oxlintrc.json';
}

// Dize içeriğini koruyarak // ve /* */ yorumlarını ve sondaki virgülleri kaldırır.
export function stripJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (j < text.length && text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      out += text.slice(i, j + 1);
      i = j;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      const end = text.indexOf('*/', i + 2);
      i = end < 0 ? text.length : end + 1;
    } else {
      out += c;
    }
  }
  return out.replace(/,(\s*[}\]])/g, '$1');
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--file') out.file = argv[++i];
    else if (argv[i] === '--root') out.root = argv[++i];
  }
  return out;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString('utf8');
}

function isInside(root, abs) {
  const rel = path.relative(root, abs);
  return rel !== '' && !rel.startsWith('..') && !path.isAbsolute(rel);
}

export function validateFile(root, abs) {
  const errors = [];
  const warnings = [];
  const rel = path.relative(root, abs);
  const parts = rel.split(path.sep);
  if (parts.some((p) => SKIP_DIRS.has(p)) || rel.split(path.sep).join('/').startsWith('data/raw/')) {
    return { skipped: 'yoksayılan dizin', errors, warnings };
  }
  let stat;
  try {
    stat = fs.statSync(abs);
  } catch {
    return { skipped: 'dosya bulunamadı', errors, warnings };
  }
  if (!stat.isFile()) return { skipped: 'dosya değil', errors, warnings };
  if (stat.size > MAX_BYTES) return { skipped: `>${MAX_BYTES} bayt, hook kapsamı dışında`, errors, warnings };

  const ext = path.extname(abs).toLowerCase();
  const base = path.basename(abs).toLowerCase();
  if (!TEXT_EXT.has(ext) && !base.startsWith('.env')) return { skipped: 'kontrol edilmeyen uzantı', errors, warnings };

  const buf = fs.readFileSync(abs);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(buf);
  } catch {
    errors.push('geçerli UTF-8 değil');
    return { errors, warnings };
  }
  const hasBom = text.charCodeAt(0) === 0xfeff;
  if (hasBom) text = text.slice(1);

  if (PRIVATE_KEY_RE.test(text)) errors.push('özel anahtar (PRIVATE KEY) içeriği tespit edildi; sırlar repoya yazılmaz');
  if (base === '.env') warnings.push('.env yerel sır dosyasıdır; Git dışında kaldığını doğrulayın');

  if (ext === '.json') {
    if (hasBom) errors.push('JSON dosyası BOM ile başlıyor; BOM olmadan UTF-8 yazın');
    try {
      JSON.parse(isJsonc(rel) ? stripJsonc(text) : text);
    } catch (err) {
      errors.push(`JSON parse hatası: ${err.message}`);
    }
  } else if (ext === '.yml' || ext === '.yaml') {
    if (!yamlAvailable()) warnings.push(yamlUnavailableReason());
    else {
      try {
        parseYaml(text);
      } catch (err) {
        errors.push(`YAML parse hatası: ${err.message.split('\n')[0]}`);
      }
    }
  } else if (ext === '.mjs' || ext === '.js' || ext === '.cjs') {
    try {
      execFileSync(process.execPath, ['--check', abs], { stdio: 'pipe', timeout: NODE_CHECK_TIMEOUT_MS });
    } catch (err) {
      if (err.code === 'ETIMEDOUT' || err.signal === 'SIGTERM') warnings.push('node --check zaman aşımına uğradı; kontrol atlandı');
      else errors.push(`node --check sözdizimi hatası: ${String(err.stderr ?? err.message).trim().split('\n').slice(0, 4).join(' | ')}`);
    }
  } else if (ext === '.md') {
    const kind = classifyClaudeFile(rel);
    if (kind && !yamlAvailable()) warnings.push(`${yamlUnavailableReason()}; frontmatter kontrolü atlandı`);
    else if (kind) errors.push(...checkClaudeMarkdown(kind, rel, text).errors);
  }
  return { errors, warnings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  let root = args.root ?? process.env.CLAUDE_PROJECT_DIR;
  let target = args.file;

  if (!target) {
    const raw = await readStdin();
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      // Bozuk/boş hook girdisi kullanıcının işini engellememeli.
      process.stderr.write('validate-changed-files: hook girdisi JSON değil; kontrol atlandı\n');
      process.exit(0);
    }
    target = payload?.tool_input?.file_path ?? payload?.tool_input?.path;
    root ??= payload?.cwd;
    if (!target) process.exit(0);
  }
  root = path.resolve(root ?? process.cwd());
  const abs = path.resolve(root, target);
  if (!isInside(root, abs)) process.exit(0); // proje kökü dışı: bu hook'un sorumluluğu değil

  const result = validateFile(root, abs);
  const rel = path.relative(root, abs).split(path.sep).join('/');
  for (const w of result.warnings) process.stderr.write(`uyarı ${rel}: ${w}\n`);
  if (result.errors.length) {
    process.stderr.write(`GeoMosk doğrulama hatası (${rel}):\n${result.errors.map((e) => `  - ${e}`).join('\n')}\n`);
    process.exit(2);
  }
  process.exit(0);
}

const invokedDirectly = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) await main();
