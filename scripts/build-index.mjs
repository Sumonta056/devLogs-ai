// Regenerates index.html pages.
//   /                           → home (public reports only)
//   /<report>/                  → archive list, newest first
//   /<report>/YYYY-MM-DD.html   → one edition
//   /personal-guide/*           → login required (see middleware.js)
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PROFILE, REPORTS } from './site-config.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const decode = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

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

// Files are named YYYY-MM-DD.html or <prefix>-YYYY-MM-DD.html → newest first
const EDITION = /^(?:.+-)?(\d{4}-\d{2}-\d{2})\.html$/;
const dateOf = (f) => f.match(EDITION)[1];

const readEdition = (r, file) => {
  const html = readFileSync(join(ROOT, r.dir, file), 'utf8');
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const meta = (html.match(/<meta\b[^>]*>/gi) || []).find((m) => /name=["']keywords["']/i.test(m));
  const keywords = meta?.match(/content=["']([^"']*)["']/i)?.[1];
  const topics = keywords
    ? decode(keywords).split(',').map((t) => t.trim()).filter(Boolean)
    : [...html.matchAll(/<h2[^>]*>([\s\S]*?)<\/h2>/gi)].map((m) => decode(m[1])).filter(Boolean).slice(0, 4);
  return {
    file,
    date: dateOf(file),
    title: (h1 && decode(h1[1])) || (title && decode(title[1])) || r.title,
    topics,
  };
};

const editions = (r) => {
  const abs = join(ROOT, r.dir);
  if (!existsSync(abs)) return [];
  return readdirSync(abs)
    .filter((f) => EDITION.test(f))
    .sort((a, b) => dateOf(b).localeCompare(dateOf(a)) || b.localeCompare(a))
    .map((f) => readEdition(r, f));
};

const DATA = REPORTS.map((r) => ({ ...r, editions: editions(r) }));
const PUBLIC = DATA.filter((r) => r.visibility === 'public');
const POSTS = PUBLIC.flatMap((r) => r.editions.map((e) => ({ r, e }))).sort((a, b) => b.e.date.localeCompare(a.e.date));

const fmt = (s, o) => new Date(s + 'T00:00:00Z').toLocaleDateString('en-GB', { timeZone: 'UTC', ...o });
const short = (s) => (s ? fmt(s, { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const cv = (r) => `--c:${r.color};--on:${r.on};--ink:${r.ink}`;
const badge = (r) => `<span class="a-badge">${icon(r.icon)}</span>`;
const tri = `linear-gradient(90deg,${PUBLIC.map((r, i) => `${r.color} ${(i * 100 / PUBLIC.length).toFixed(1)}% ${((i + 1) * 100 / PUBLIC.length).toFixed(1)}%`).join(',')})`;
const tags = (list) => (list.length ? `<div class="a-tags">${list.map((t) => `<span>${esc(t)}</span>`).join('')}</div>` : '');
const stats = (items, colored) => `<div class="a-stats${colored ? ' colored' : ''}">${items.map(([v, l]) => `<div class="a-stat"><b>${esc(v)}</b><span>${l}</span></div>`).join('')}</div>`;
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
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/site.css">
</head><body style="--tri:${tri}">${body}</body></html>`;

const nav = (active) => `
<nav class="a-nav"><div class="a-nav-in">
  <a class="a-brand" href="/"><b>${icon('newspaper')}</b><span>${esc(SITE.title)}</span></a>
  <div class="a-links">
    <a href="/"${active === 'home' ? ' aria-current="page"' : ''}>Home</a>
    ${PUBLIC.map((r) => `<a style="${cv(r)}" href="/${r.dir}/"${active === r.dir ? ' aria-current="page"' : ''}>${icon(r.icon)}${esc(r.short)}</a>`).join('')}
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
    <h4>How often I post</h4>
    <ul class="a-sched">${PUBLIC.map((r) => `<li style="${cv(r)}"><span>${badge(r)}${esc(r.short)}</span><em>${esc(r.cadence)}</em></li>`).join('')}</ul>
    <h4>Find me</h4>
    <div class="a-social">${PROFILE.links.map((l) => `<a href="${esc(l.href)}">${icon(l.icon)}${esc(l.label)}</a>`).join('')}</div>
    ${POSTS.length ? `<div class="a-total"><b>${plural(POSTS.length, 'issue')}</b> since ${fmt(POSTS.at(-1).e.date, { month: 'short', year: 'numeric' })}</div>` : ''}
  </div>
</div></aside>`;

const homePage = () => {
  const last = POSTS[0]?.e.date;
  const thisMonth = last ? POSTS.filter((p) => p.e.date.slice(0, 7) === last.slice(0, 7)).length : 0;
  const cards = PUBLIC.map((r) => {
    const e = r.editions[0];
    const meta = e
      ? `<b>${plural(r.editions.length, 'issue')}</b> · Latest: ${esc(e.title)} · ${short(e.date)}`
      : 'No issues yet';
    return `
    <a class="a-cat" style="${cv(r)}" href="/${r.dir}/">
      ${badge(r)}
      <div>
        <h2>${esc(r.title)}</h2>
        <p class="desc">${esc(r.about)}</p>
        ${tags(r.tags)}
        <div class="a-meta">${meta}</div>
      </div>
      <span class="a-go">→</span>
    </a>`;
  }).join('');
  return layout(SITE.title, SITE.intro, `${nav('home')}<div class="a-wrap"><main>
    <header class="a-head"><h1>${esc(SITE.title)}</h1><p>${esc(SITE.intro)}</p></header>
    ${stats([[POSTS.length, `${POSTS.length === 1 ? 'issue' : 'issues'} published`], [PUBLIC.length, PUBLIC.length === 1 ? 'newsletter' : 'newsletters'], [short(last), 'last update'], [thisMonth, `${thisMonth === 1 ? 'issue' : 'issues'} this month`]], false)}
    <div class="a-label">Newsletters</div>
    ${cards}
  </main>${side()}</div>`);
};

const archivePage = (r) => {
  const list = r.editions;
  const topics = new Set(list.flatMap((e) => e.topics)).size;
  const months = list.length
    ? byMonth(list).map(([month, items]) => `
      <div class="a-month">${month}<span>${plural(items.length, 'issue')}</span></div>
      ${items.map((e) => `
        <a class="a-row" href="/${r.dir}/${encodeURIComponent(e.file)}">
          <div class="a-date"><b>${fmt(e.date, { day: 'numeric' })}</b><span>${fmt(e.date, { weekday: 'short' })}</span></div>
          <div><h3>${esc(e.title)}${e === list[0] ? '<span class="a-new">New</span>' : ''}</h3>${tags(e.topics)}</div>
          <span class="a-go">→</span>
        </a>`).join('')}`).join('')
    : '<div class="a-empty">No issues yet.</div>';
  return layout(`${r.title} · ${SITE.title}`, r.about, `${nav(r.dir)}<div class="a-wrap" style="${cv(r)}"><main>
    <div class="a-crumb"><a href="/">Home</a> / ${esc(r.short)}</div>
    <header class="a-head"><h1>${badge(r)}${esc(r.title)}</h1><p>${esc(r.about)}</p></header>
    ${stats([[list.length, `${list.length === 1 ? 'issue' : 'issues'} published`], [short(list[0]?.date), 'last update'], [short(list.at(-1)?.date), 'first issue'], [topics, `${topics === 1 ? 'topic' : 'topics'} covered`]], true)}
    ${months}
  </main>${side()}</div>`);
};

for (const r of DATA) writeFileSync(join(ROOT, r.dir, 'index.html'), archivePage(r));
writeFileSync(join(ROOT, 'index.html'), homePage());

console.log('Indexes rebuilt:', DATA.map((r) => `${r.dir}=${r.editions.length}`).join(', '));
