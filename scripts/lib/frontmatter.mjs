// Claude Code agent/skill/rule markdown dosyaları için ortak frontmatter kontrolleri.
// Hem PostToolUse hook'u hem verify-agent-setup.mjs kullanır; kurallar tek yerde kalsın.
import path from 'node:path';

let yamlModule;
let yamlLoadError;
try {
  yamlModule = await import('yaml');
} catch (err) {
  yamlLoadError = err;
}

export const yamlAvailable = () => Boolean(yamlModule);
export const yamlUnavailableReason = () =>
  yamlLoadError ? `yaml paketi yüklenemedi (npm install çalıştırın): ${yamlLoadError.code ?? yamlLoadError.message}` : null;

export function parseYaml(text) {
  if (!yamlModule) throw new Error(yamlUnavailableReason());
  return yamlModule.parse(text);
}

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text) {
  const m = FRONTMATTER_RE.exec(text);
  if (!m) return { hasFrontmatter: false, raw: null, body: text };
  return { hasFrontmatter: true, raw: m[1], body: text.slice(m[0].length) };
}

// Proje kökünden göreli, '/' ayraçlı yola göre dosya türünü belirler.
export function classifyClaudeFile(relPath) {
  const p = relPath.split(path.sep).join('/');
  if (/^\.claude\/agents\/[^/]+\.md$/.test(p)) return 'agent';
  if (/^\.claude\/skills\/[^/]+\/SKILL\.md$/.test(p)) return 'skill';
  if (/^\.claude\/rules\/[^/]+\.md$/.test(p)) return 'rule';
  return null;
}

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Dönüş: { errors: string[], data: object|null }
export function checkClaudeMarkdown(kind, relPath, text) {
  const errors = [];
  const fm = splitFrontmatter(text);
  if (kind === 'rule' && !fm.hasFrontmatter) {
    // Frontmatter'sız rule geçerlidir: her oturumda koşulsuz yüklenir.
    if (fm.body.trim().length < 200) errors.push('rule içeriği anlamlı olmak için çok kısa');
    return { errors, data: null };
  }
  if (!fm.hasFrontmatter) {
    errors.push('YAML frontmatter (--- ... ---) bulunamadı');
    return { errors, data: null };
  }
  if (!yamlAvailable()) {
    errors.push(yamlUnavailableReason());
    return { errors, data: null };
  }
  let data;
  try {
    data = parseYaml(fm.raw) ?? {};
  } catch (err) {
    errors.push(`frontmatter YAML parse hatası: ${err.message.split('\n')[0]}`);
    return { errors, data: null };
  }
  if (typeof data !== 'object' || Array.isArray(data)) {
    errors.push('frontmatter bir YAML eşlemi (mapping) olmalı');
    return { errors, data: null };
  }

  const base = path.basename(relPath, '.md');
  const dirName = path.basename(path.dirname(relPath));
  if (kind === 'agent' || kind === 'skill') {
    for (const field of ['name', 'description']) {
      if (typeof data[field] !== 'string' || !data[field].trim()) errors.push(`'${field}' alanı zorunlu ve metin olmalı`);
    }
    if (typeof data.name === 'string') {
      if (!NAME_RE.test(data.name)) errors.push(`'name' küçük harf/rakam/tire olmalı: ${data.name}`);
      const expected = kind === 'agent' ? base : dirName;
      if (data.name !== expected) errors.push(`'name' (${data.name}) dosya/dizin adıyla (${expected}) aynı olmalı`);
    }
    if (typeof data.description === 'string' && data.description.trim().length < 40) {
      errors.push("'description' ne zaman kullanılacağını anlatmak için çok kısa");
    }
  }
  if (kind === 'rule' && data.paths !== undefined) {
    if (!Array.isArray(data.paths) || data.paths.length === 0 || !data.paths.every((g) => typeof g === 'string' && g.trim())) {
      errors.push("'paths' boş olmayan bir metin dizisi olmalı");
    }
  }
  if (fm.body.trim().length < 200) errors.push('gövde içeriği anlamlı olmak için çok kısa');
  return { errors, data };
}
