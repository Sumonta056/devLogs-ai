const NAME_DATE = /^(?:.+-)?(\d{4}-\d{2}-\d{2})\.html$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const NAMED = { mdash: '\u2014', ndash: '\u2013', rsquo: '\u2019', lsquo: '\u2018', rdquo: '\u201d', ldquo: '\u201c', hellip: '\u2026' };

const isDay = (s) => {
  const d = new Date(`${s}T00:00:00Z`);
  return DAY.test(s) && !Number.isNaN(d.getTime()) && d.toISOString().startsWith(s);
};

export const decode = (s) => s
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
  .replace(/&(mdash|ndash|rsquo|lsquo|rdquo|ldquo|hellip);/g, (_, k) => NAMED[k])
  .replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export const isEntryFile = (name) => name.endsWith('.html') && name !== 'index.html';

export const dateFromName = (file) => {
  const day = file.match(NAME_DATE)?.[1];
  return day && isDay(day) ? day : null;
};

export const localDay = (ms) => {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

export const resolveDate = (file, saved, mtimeMs) => {
  const named = dateFromName(file);
  if (named) return { date: named, source: 'name' };
  if (saved) return { date: saved, source: 'saved' };
  return { date: localDay(mtimeMs), source: 'mtime' };
};

export const parseDates = (text) => {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { dates: {}, ok: false };
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { dates: {}, ok: false };
  const dates = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string' && isDay(v)));
  return { dates, ok: true };
};

export const serializeDates = (dates) => {
  const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${JSON.stringify(sorted, null, 2)}\n`;
};

const visible = (html) => html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '');

export const titleOf = (raw, file) => {
  const html = visible(raw);
  for (const re of [/<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]) {
    const text = decode(html.match(re)?.[1] ?? '');
    if (text) return text;
  }
  return file.replace(/\.html$/, '');
};

export const topicsOf = (raw) => {
  const html = visible(raw);
  const meta = (html.match(/<meta\b[^>]*>/gi) || []).find((m) => /name=["']keywords["']/i.test(m));
  const keywords = meta?.match(/content=["']([^"']*)["']/i)?.[1];
  return keywords
    ? decode(keywords).split(',').map((t) => t.trim()).filter(Boolean)
    : [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => decode(m[1])).filter(Boolean).slice(0, 4);
};

const newestFirst = (a, b) => b.date.localeCompare(a.date);

export const sortEntries = (kind, entries, order = []) => {
  if (kind === 'news') {
    return { placed: [...entries].sort((a, b) => newestFirst(a, b) || b.file.localeCompare(a.file)), unplaced: [], missing: [] };
  }
  if (kind === 'guides') {
    return { placed: [...entries].sort((a, b) => newestFirst(a, b) || a.title.localeCompare(b.title)), unplaced: [], missing: [] };
  }
  if (kind !== 'roadmap') throw new Error(`unknown kind: ${kind}`);
  const steps = [...new Set(order)];
  const byFile = new Map(entries.map((e) => [e.file, e]));
  return {
    placed: steps.filter((f) => byFile.has(f)).map((f) => byFile.get(f)),
    unplaced: entries.filter((e) => !steps.includes(e.file)).sort(newestFirst),
    missing: steps.filter((f) => !byFile.has(f)),
  };
};

export const entryHref = (base, dir, file) => `${base}/${dir}/${encodeURIComponent(file)}`;

export const publicDirs = (reports) => reports.filter((r) => r.visibility === 'public').map((r) => r.dir);

export const WIDGET_TAG = '<script src="../assets/nav-widget.js" defer data-devlogs-nav></script>';

export const injectWidget = (html) => {
  if (html.includes('data-devlogs-nav')) return null;
  const i = html.toLowerCase().lastIndexOf('</body>');
  return i === -1 ? `${html}\n${WIDGET_TAG}\n` : `${html.slice(0, i)}${WIDGET_TAG}\n${html.slice(i)}`;
};

const link = (e) => ({ file: e.file, title: e.title });

export const navData = (sections) => ({
  sections: sections.filter((s) => s.visibility === 'public').map((s) => ({
    dir: s.dir,
    short: s.short,
    color: s.color,
    on: s.on,
    entries: [
      ...s.entries.map((e, i) => (s.kind === 'roadmap' ? { ...link(e), n: i + 1 } : link(e))),
      ...s.unplaced.map(link),
    ],
  })),
});

const CSP_META = /<meta\b[^>]*http-equiv=["']?content-security-policy["'\s>][^>]*>/i;

const addSelf = (policy) => {
  const parts = policy.split(';').map((p) => p.trim()).filter(Boolean);
  const find = (name) => parts.findIndex((p) => p.split(/\s+/)[0].toLowerCase() === name);
  const def = find('default-src');
  const defTokens = def === -1 ? [] : parts[def].split(/\s+/).slice(1);
  let changed = false;
  for (const name of ['script-src', 'connect-src']) {
    const i = find(name);
    if (i === -1) {
      if (def === -1 || defTokens.includes("'self'")) continue;
      parts.push([name, ...defTokens.filter((t) => t !== "'none'"), "'self'"].join(' '));
    } else {
      const tokens = parts[i].split(/\s+/);
      if (tokens.includes("'self'")) continue;
      parts[i] = [...tokens.filter((t) => t !== "'none'"), "'self'"].join(' ');
    }
    changed = true;
  }
  return changed ? parts.join('; ') : null;
};

export const allowSelf = (html) => {
  const meta = html.match(CSP_META)?.[0];
  const content = meta?.match(/\bcontent="([^"]*)"/i);
  const next = content && !content[1].includes('&') && addSelf(content[1]);
  if (!next) return null;
  const fixed = meta.replace(content[0], () => `${content[0].slice(0, content[0].indexOf('"'))}"${next}"`);
  return html.replace(meta, () => fixed);
};
