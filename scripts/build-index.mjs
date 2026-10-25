import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, utimesSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { SITE, PROFILE, REPORTS } from './site-config.mjs';
import {
  isEntryFile, resolveDate, parseDates, serializeDates, titleOf, topicsOf, sortEntries, entryHref,
  injectWidget, navData, allowSelf,
} from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const DATES_FILE = join(ROOT, 'scripts/dates.json');
const CSS_VER = createHash('sha1').update(readFileSync(join(ROOT, 'assets/site.css'))).digest('hex').slice(0, 8);

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const icons = {};
const icon = (name) => {
  if (!(name in icons)) {
    const svg = readFileSync(join(ROOT, 'assets/icons', `${name}.svg`), 'utf8')
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<title>[\s\S]*?<\/title>/g, '')
      .trim()
      .replace(/^<svg[^>]*>/, (tag) => tag.replace(/\s(class|width|height|role)="[^"]*"/g, ''));
    const fill = /\sfill="/.test(svg.slice(0, svg.indexOf('>'))) ? '' : ' fill="currentColor"';
    icons[name] = svg.replace('<svg', `<svg class="ic" aria-hidden="true"${fill}`);
  }
  return icons[name];
};

const loadDates = () => {
  if (!existsSync(DATES_FILE)) {
    console.warn('warn: scripts/dates.json not found, starting from {}');
    return {};
  }
  const { dates, ok } = parseDates(readFileSync(DATES_FILE, 'utf8'));
  if (!ok) console.warn('warn: scripts/dates.json is not valid JSON, starting from {}');
  return dates;
};

const SAVED = loadDates();
const NEXT = {};

let added = 0;

const readEntry = (r, file) => {
  const abs = join(ROOT, r.dir, file);
  const html = readFileSync(abs, 'utf8');
  const st = statSync(abs);
  const key = `${r.dir}/${file}`;
  const { date, source } = resolveDate(file, SAVED[key], st.mtimeMs);
  if (source !== 'name') NEXT[key] = date;
  const csp = allowSelf(html);
  const next = injectWidget(csp ?? html) ?? csp;
  if (next !== null) {
    writeFileSync(abs, next);
    utimesSync(abs, st.atime, st.mtime);
    added += 1;
  }
  return { file, date, title: r.titles?.[file] ?? titleOf(html, file), topics: topicsOf(html) };
};

const load = (r) => {
  const abs = join(ROOT, r.dir);
  const files = existsSync(abs) ? readdirSync(abs).filter(isEntryFile) : [];
  const { placed, unplaced, missing } = sortEntries(r.kind, files.map((f) => readEntry(r, f)), r.order);
  for (const e of unplaced) console.warn(`warn: ${r.dir}/${e.file} is not in order`);
  for (const f of missing) console.warn(`warn: ${r.dir} order item ${f} not found`);
  return { ...r, entries: placed, unplaced, all: [...placed, ...unplaced] };
};

const DATA = REPORTS.map(load);
const PUBLIC = DATA.filter((r) => r.visibility === 'public');
const NEWS = PUBLIC.filter((r) => r.kind === 'news');
const LEARN = PUBLIC.filter((r) => r.kind !== 'news');
const pairs = (list) => list
  .flatMap((r) => r.all.map((e) => ({ r, e })))
  .sort((a, b) => b.e.date.localeCompare(a.e.date));
const COACH = LEARN.find((r) => r.kind === 'roadmap');
const POSTS = pairs(NEWS);
const GUIDES = pairs(LEARN);
const ITEMS = pairs(PUBLIC);

const fmt = (s, o) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
const short = (s) => (s ? fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const word = (n, one) => (n === 1 ? one : `${one}s`);
const cv = (r) => `--c:${r.color};--on:${r.on};--ink:${r.ink}`;
const badge = (r) => `<span class="a-badge">${icon(r.icon)}</span>`;
const tri = `linear-gradient(90deg,${PUBLIC.map((r, i) => `${r.color} ${(i * 100 / PUBLIC.length).toFixed(1)}% ${((i + 1) * 100 / PUBLIC.length).toFixed(1)}%`).join(',')})`;
const tags = (list) => (list.length ? `<div class="a-tags">${list.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '');
const stats = (items, colored) => `<div class="a-stats${colored ? ' colored' : ''}" style="--n:${items.length}">${items.map(([v, l]) => `<div class="a-stat"><b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>`;
const topicCount = (list) => new Set(list.flatMap((e) => e.topics)).size;
const byMonth = (list) => {
  const groups = new Map();
  for (const e of list) {
    const key = fmt(e.date, { month: 'long', year: 'numeric' });
    groups.set(key, [...(groups.get(key) || []), e]);
  }
  return [...groups];
};

const layout = (title, description, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<link rel="icon" type="image/svg+xml" href="${BASE}/assets/favicon.svg">
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BASE}/assets/site.css?v=${CSS_VER}">
</head><body style="--tri:${tri}">${body}</body></html>`;

const nav = (active) => `
<nav class="a-nav"><div class="a-nav-in">
  <a class="a-brand" href="${BASE}/"><b>${icon('newspaper')}</b><span>${esc(SITE.title)}</span></a>
  <div class="a-links">
    <a href="${BASE}/"${active === 'home' ? ' aria-current="page"' : ''}>Home</a>
    ${PUBLIC.map((r) => `<a style="${cv(r)}" href="${BASE}/${r.dir}/"${active === r.dir ? ' aria-current="page"' : ''}>${icon(r.icon)}${esc(r.short)}</a>`).join('')}
  </div>
</div></nav>`;

const side = () => `
<aside class="a-side"><div class="a-me">
  <div class="band"></div>
  <div class="body">
    <div class="a-avatar">${PROFILE.photo ? `<img src="${esc(PROFILE.photo)}" alt="${esc(PROFILE.name)}">` : esc(PROFILE.initials)}</div>
    <h3>${esc(PROFILE.name)}</h3>
    <p class="a-role">${esc(PROFILE.role)}</p>
    <p class="a-bio">${esc(PROFILE.bio)}</p>
    <h4>When the agent runs</h4>
    <ul class="a-sched">${NEWS.map((r) => `<li style="${cv(r)}"><span>${badge(r)}${esc(r.short)}</span><em>${esc(r.cadence)}</em></li>`).join('')}</ul>
    ${COACH?.entries.length ? `<h4>${esc(COACH.title)}</h4>
    <a class="a-coach" style="${cv(COACH)}" href="${BASE}/${COACH.dir}/">
      ${badge(COACH)}
      <span><b>${esc(COACH.title)}<em>Trending</em></b><small>${plural(COACH.entries.length, 'step')} · Start at step 1</small></span>
    </a>` : ''}
    <h4>Find me</h4>
    <div class="a-social">${PROFILE.links.map((l) => `<a href="${esc(l.href)}">${icon(l.icon)}${esc(l.label)}</a>`).join('')}</div>
    ${ITEMS.length ? `<div class="a-total"><b>${plural(POSTS.length, 'issue')} · ${plural(GUIDES.length, 'guide')}</b> since ${fmt(ITEMS.at(-1).e.date, { month: 'short', year: 'numeric' })}</div>` : ''}
  </div>
</div></aside>`;

const cardMeta = (r) => {
  if (r.kind === 'roadmap') return `<b>Roadmap</b> · ${plural(r.entries.length, 'step')}`;
  const e = r.entries[0];
  const unit = r.kind === 'news' ? 'issue' : 'guide';
  if (!e) return `No ${unit}s yet`;
  return `<b>${plural(r.entries.length, unit)}</b> · Latest: ${esc(e.title)} · ${short(e.date)}`;
};

const card = (r) => `
    <a class="a-cat" style="${cv(r)}" href="${BASE}/${r.dir}/">
      ${badge(r)}
      <div>
        <h2>${esc(r.title)}</h2>
        <p class="desc">${esc(r.about)}</p>
        ${tags(r.tags)}
        <div class="a-meta">${cardMeta(r)}</div>
      </div>
      <span class="a-go">→</span>
    </a>`;

const homePage = () => {
  const last = ITEMS[0]?.e.date;
  const thisMonth = last ? ITEMS.filter((p) => p.e.date.slice(0, 7) === last.slice(0, 7)).length : 0;
  const group = (label, list) => (list.length ? `<div class="a-label">${label}</div>${list.map(card).join('')}` : '');
  return layout(SITE.title, SITE.intro, `${nav('home')}<div class="a-wrap"><main>
    <header class="a-head"><h1>${esc(SITE.title)}</h1><p>${esc(SITE.intro)}</p></header>
    ${stats([
      [POSTS.length, `${word(POSTS.length, 'issue')} published`],
      [GUIDES.length, word(GUIDES.length, 'guide')],
      [short(last), 'last update'],
      [thisMonth, `${word(thisMonth, 'item')} this month`],
    ], false)}
    ${group('Weekly news', NEWS)}
    ${group('Learning', LEARN)}
  </main>${side()}</div>`);
};

const sectionPage = (r, statItems, body) => layout(`${r.title} · ${SITE.title}`, r.about, `${nav(r.dir)}<div class="a-wrap" style="${cv(r)}"><main>
    <div class="a-crumb"><a href="${BASE}/">Home</a> / ${esc(r.short)}</div>
    <header class="a-head"><h1>${badge(r)}${esc(r.title)}</h1><p>${esc(r.about)}</p></header>
    ${stats(statItems, true)}
    ${body}
  </main>${side()}</div>`);

const newsPage = (r) => {
  const list = r.entries;
  const topics = topicCount(list);
  const body = list.length
    ? byMonth(list).map(([month, items]) => `
      <div class="a-month">${month}<span>${plural(items.length, 'issue')}</span></div>
      ${items.map((e) => `
        <a class="a-row" href="${entryHref(BASE, r.dir, e.file)}">
          <div class="a-date"><b>${fmt(e.date, { day: 'numeric' })}</b><span>${fmt(e.date, { weekday: 'short' })}</span></div>
          <div><h3>${esc(e.title)}${e === list[0] ? '<span class="a-new">New</span>' : ''}</h3>${tags(e.topics)}</div>
          <span class="a-go">→</span>
        </a>`).join('')}`).join('')
    : '<div class="a-empty">No issues yet.</div>';
  return sectionPage(r, [
    [list.length, `${word(list.length, 'issue')} published`],
    [short(list[0]?.date), 'last update'],
    [short(list.at(-1)?.date), 'first issue'],
    [topics, `${word(topics, 'topic')} covered`],
  ], body);
};

const guideRow = (r, e, label = '') => `
  <a class="a-row a-guide" href="${entryHref(BASE, r.dir, e.file)}">
    <div><h3>${esc(e.title)}${label ? `<span class="a-new">${label}</span>` : ''}</h3>${tags(e.topics)}<div class="a-meta">Added ${short(e.date)}</div></div>
    <span class="a-go">→</span>
  </a>`;

const guidesPage = (r) => {
  const list = r.entries;
  const topics = topicCount(list);
  const body = list.length
    ? `<div class="a-list">${list.map((e) => guideRow(r, e)).join('')}</div>`
    : '<div class="a-empty">No guides yet.</div>';
  return sectionPage(r, [
    [list.length, word(list.length, 'guide')],
    [short(list[0]?.date), 'last added'],
    [topics, `${word(topics, 'topic')} covered`],
  ], body);
};

const roadmapPage = (r) => {
  const steps = r.entries;
  const topics = topicCount(r.all);
  const latest = [...r.all].sort((a, b) => b.date.localeCompare(a.date))[0];
  const list = steps.length
    ? `<ol class="a-steps">${steps.map((e, i) => `<li class="a-step"><span class="a-num">${i + 1}</span>${guideRow(r, e, i === 0 ? 'Start here' : '')}</li>`).join('')}</ol>`
    : '<div class="a-empty">No steps yet.</div>';
  const rest = r.unplaced.length
    ? `<div class="a-month">Not placed yet<span>${plural(r.unplaced.length, 'guide')}</span></div>${r.unplaced.map((e) => guideRow(r, e)).join('')}`
    : '';
  return sectionPage(r, [
    [steps.length, word(steps.length, 'step')],
    [topics, `${word(topics, 'topic')} covered`],
    [short(latest?.date), 'last added'],
  ], list + rest);
};

const PAGES = { news: newsPage, guides: guidesPage, roadmap: roadmapPage };

for (const r of DATA) {
  mkdirSync(join(ROOT, r.dir), { recursive: true });
  writeFileSync(join(ROOT, r.dir, 'index.html'), PAGES[r.kind](r));
}
writeFileSync(join(ROOT, 'index.html'), homePage());

const writeIfChanged = (path, text) => {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
};
writeIfChanged(DATES_FILE, serializeDates(NEXT));
writeIfChanged(join(ROOT, 'assets/nav-data.json'), `${JSON.stringify(navData(DATA))}\n`);

console.log('Indexes rebuilt:', DATA.map((r) => `${r.dir}=${r.all.length}`).join(', '));
if (added) console.log(`Widget updated: ${plural(added, 'file')}`);
