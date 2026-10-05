# Learning Sections and DevLogs AI Rename Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show all report and guide HTML files on the site, add 3 learning sections (one of them a roadmap), and rename the site to DevLogs AI.

**Architecture:** A static site builder in plain Node. `scripts/build-index.mjs` scans each section folder in `scripts/site-config.mjs`, makes one entry for each HTML file, and writes an `index.html` for each section plus the home page. Each section has a `kind` (`news`, `guides`, `roadmap`) that selects its sort rule and its page renderer. Pure logic moves to `scripts/lib.mjs` so that `node:test` can test it. Dates of files without a date in the name are frozen in `scripts/dates.json`.

**Tech Stack:** Node 20 (ESM `.mjs`), `node:test`, `node:assert/strict`, plain CSS, GitHub Actions (GitHub Pages), Vercel (private section).

**Spec:** `docs/superpowers/specs/2026-10-05-learning-sections-design.md`

## Global Constraints

- Node 20. CI uses `node-version: 20`. Local is v20.19.6.
- No npm dependencies. Use only Node built-in modules.
- Do not write code comments. This is a user rule. The lucide license line in a copied SVG icon is a third-party notice, so keep it.
- Do not run `git commit` or `git push` until the user says yes. Each task ends with a stop to ask.
- Display title: `DevLogs AI`. Slug: `devlogs-ai-sumonta056`.
- Do not change report HTML files, `middleware.js`, `vercel.json`, or `scripts/publish.sh`.
- Section kinds are exactly `news`, `guides`, `roadmap`.
- Warning texts, exactly:
  - `warn: scripts/dates.json not found, starting from {}`
  - `warn: scripts/dates.json is not valid JSON, starting from {}`
  - `warn: <dir>/<file> is not in order`
  - `warn: <dir> order item <file> not found`
- Empty states, exactly: `No issues yet.` (news), `No guides yet.` (guides), `No steps yet.` (roadmap).
- Date of an entry: date in the file name, then `dates.json`, then the local calendar day of the file modified time.
- `.gitignore` must use `/Icon?`, not `Icon?`. This repo has `core.ignorecase=true`, so `Icon?` also matches `assets/icons`.

## Review Focus

1. File names with spaces, `&`, or `_` (for example `Vue & Nuxt Friday Brief.html`). The link must open the file. Task 1 tests `entryHref`. Task 4 opens one in a browser.
2. A broken or hand-edited `scripts/dates.json`. The build must not crash, and it must drop bad values. Task 1 tests `parseDates`. Task 3 runs a build with a broken file in a scratch copy.
3. The agent rewrites an old file, so its modified time changes. The saved date must not change. Task 1 tests that `resolveDate` prefers the saved date over the modified time. Task 3 checks that a second build does not change `dates.json`.
4. Config typos: a wrong `kind`, or the same file twice in `order`. The build must stop with a clear error for a wrong kind, and it must not show a step twice. Task 1 tests both in `sortEntries`.
5. A section folder that does not exist yet. The build must not crash, and the page must show the empty state. Task 3 runs a build without `investment-bd` in a scratch copy.

---

### Task 1: Pure helpers with tests

**Files:**
- Create: `scripts/lib.mjs`
- Create: `scripts/lib.test.mjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: nothing.
- Produces (all named exports of `scripts/lib.mjs`):
  - `decode(s: string): string` — strips tags, decodes the 6 common entities, folds spaces.
  - `isEntryFile(name: string): boolean` — `true` for `*.html` except `index.html`.
  - `dateFromName(file: string): string | null` — `YYYY-MM-DD` from `YYYY-MM-DD.html` or `<prefix>-YYYY-MM-DD.html`.
  - `localDay(ms: number): string` — local calendar day as `YYYY-MM-DD`.
  - `resolveDate(file: string, saved: string | undefined, mtimeMs: number): { date: string, source: 'name' | 'saved' | 'mtime' }`
  - `parseDates(text: string): { dates: Record<string, string>, ok: boolean }`
  - `serializeDates(dates: Record<string, string>): string` — sorted keys, 2-space JSON, final newline.
  - `titleOf(html: string, file: string): string`
  - `topicsOf(html: string): string[]`
  - `sortEntries(kind: string, entries: Entry[], order?: string[]): { placed: Entry[], unplaced: Entry[], missing: string[] }` where `Entry = { file: string, date: string, title: string, topics: string[] }`. Throws `Error('unknown kind: <kind>')` for a kind that is not `news`, `guides`, or `roadmap`.
  - `entryHref(base: string, dir: string, file: string): string`
  - `publicDirs(reports: { dir: string, visibility: string }[]): string[]`

- [ ] **Step 1: Add the test script to `package.json`**

Replace the whole file with:

```json
{
  "name": "reports-site",
  "private": true,
  "scripts": {
    "build": "node scripts/build-index.mjs",
    "test": "node --test scripts/lib.test.mjs"
  }
}
```

The `name` changes in Task 2.

- [ ] **Step 2: Write the failing tests**

Create `scripts/lib.test.mjs`:

```js
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decode, isEntryFile, dateFromName, localDay, resolveDate, parseDates, serializeDates,
  titleOf, topicsOf, sortEntries, entryHref, publicDirs,
} from './lib.mjs';

const entry = (file, date, title = file) => ({ file, date, title, topics: [] });
const files = (list) => list.map((e) => e.file);

test('decode strips tags and entities', () => {
  assert.equal(decode(' Vue &amp; <em>Nuxt</em>&nbsp;&quot;Brief&quot; &#39;26 '), 'Vue & Nuxt "Brief" \'26');
});

test('isEntryFile keeps report html only', () => {
  const names = ['index.html', 'Friday Java Brief.html', '.gitkeep', '.DS_Store', 'notes.md', 'a-2026-09-27.html'];
  assert.deepEqual(names.filter(isEntryFile), ['Friday Java Brief.html', 'a-2026-09-27.html']);
});

test('dateFromName reads only YYYY-MM-DD names', () => {
  assert.equal(dateFromName('agentic-daily-2026-09-27.html'), '2026-09-27');
  assert.equal(dateFromName('2026-10-04.html'), '2026-10-04');
  assert.equal(dateFromName('Friday Java Brief.html'), null);
  assert.equal(dateFromName('Agentic Daily 4 Oct 2026.html'), null);
});

test('localDay uses the local calendar day', () => {
  assert.equal(localDay(new Date(2026, 3, 28, 0, 30).getTime()), '2026-04-28');
  assert.equal(localDay(new Date(2026, 3, 28, 23, 59).getTime()), '2026-04-28');
});

test('resolveDate prefers name, then saved, then mtime', () => {
  const mtime = new Date(2026, 9, 5, 12).getTime();
  assert.deepEqual(resolveDate('x-2026-09-27.html', '2026-01-01', mtime), { date: '2026-09-27', source: 'name' });
  assert.deepEqual(resolveDate('Brief.html', '2026-04-28', mtime), { date: '2026-04-28', source: 'saved' });
  assert.deepEqual(resolveDate('Brief.html', undefined, mtime), { date: '2026-10-05', source: 'mtime' });
});

test('parseDates keeps valid days and rejects broken input', () => {
  assert.deepEqual(
    parseDates('{"a/b.html":"2026-04-28","a/c.html":"soon","a/d.html":5}'),
    { dates: { 'a/b.html': '2026-04-28' }, ok: true },
  );
  for (const bad of ['{oops', '[]', 'null', '', '"2026-04-28"']) {
    assert.deepEqual(parseDates(bad), { dates: {}, ok: false }, bad);
  }
});

test('serializeDates sorts keys and ends with a newline', () => {
  assert.equal(
    serializeDates({ 'b/x.html': '2026-01-02', 'a/y.html': '2026-01-01' }),
    '{\n  "a/y.html": "2026-01-01",\n  "b/x.html": "2026-01-02"\n}\n',
  );
  assert.equal(serializeDates({}), '{}\n');
});

test('titleOf falls back from h1 to title to file name', () => {
  assert.equal(titleOf('<title>T</title><h1 class="x">Vue &amp; Nuxt <em>Brief</em></h1>', 'f.html'), 'Vue & Nuxt Brief');
  assert.equal(titleOf('<title>Claude Code: Configuration &amp; Extensibility</title>', 'Inside Claude.html'), 'Claude Code: Configuration & Extensibility');
  assert.equal(titleOf('<h1>  </h1><p>x</p>', 'Inside Claude.html'), 'Inside Claude');
});

test('topicsOf reads keywords, else the first 4 h2', () => {
  assert.deepEqual(topicsOf('<meta name="keywords" content="MCP, Agents , ,Vue">'), ['MCP', 'Agents', 'Vue']);
  const h2 = ['A', 'B', 'C', 'D', 'E'].map((t) => `<h2 id="${t}">${t}</h2>`).join('');
  assert.deepEqual(topicsOf(h2), ['A', 'B', 'C', 'D']);
  assert.deepEqual(topicsOf('<p>none</p>'), []);
});

test('sortEntries news: newest first, ties by file Z to A', () => {
  const { placed, unplaced, missing } = sortEntries('news', [
    entry('a.html', '2026-09-27'), entry('b.html', '2026-10-04'), entry('c.html', '2026-10-04'),
  ]);
  assert.deepEqual(files(placed), ['c.html', 'b.html', 'a.html']);
  assert.deepEqual(unplaced, []);
  assert.deepEqual(missing, []);
});

test('sortEntries guides: newest first, ties by title A to Z', () => {
  const { placed } = sortEntries('guides', [
    entry('z.html', '2026-04-28', 'Zeta'), entry('a.html', '2026-04-28', 'Alpha'), entry('n.html', '2026-10-05', 'New'),
  ]);
  assert.deepEqual(files(placed), ['n.html', 'a.html', 'z.html']);
});

test('sortEntries roadmap: order, then unplaced newest first, then missing', () => {
  const { placed, unplaced, missing } = sortEntries('roadmap', [
    entry('one.html', '2026-09-23'),
    entry('two.html', '2026-10-02'),
    entry('old.html', '2026-01-01'),
    entry('new.html', '2026-02-01'),
  ], ['two.html', 'gone.html', 'one.html', 'two.html']);
  assert.deepEqual(files(placed), ['two.html', 'one.html']);
  assert.deepEqual(files(unplaced), ['new.html', 'old.html']);
  assert.deepEqual(missing, ['gone.html']);
});

test('sortEntries roadmap without order puts all in unplaced', () => {
  const { placed, unplaced } = sortEntries('roadmap', [entry('one.html', '2026-09-23')]);
  assert.deepEqual(placed, []);
  assert.deepEqual(files(unplaced), ['one.html']);
});

test('sortEntries rejects an unknown kind', () => {
  assert.throws(() => sortEntries('blog', []), /unknown kind: blog/);
});

test('entryHref encodes spaces, ampersands and underscores safely', () => {
  assert.equal(entryHref('', 'vue-nuxt-weekly-news', 'Vue & Nuxt Friday Brief.html'), '/vue-nuxt-weekly-news/Vue%20%26%20Nuxt%20Friday%20Brief.html');
  assert.equal(
    entryHref('/repo', 'in-depth-learning', 'Join Lab_ Optimizing a 10-Table SQL Query.html'),
    '/repo/in-depth-learning/Join%20Lab_%20Optimizing%20a%2010-Table%20SQL%20Query.html',
  );
});

test('publicDirs keeps public sections in config order', () => {
  assert.deepEqual(publicDirs([
    { dir: 'a', visibility: 'public' }, { dir: 'b', visibility: 'private' }, { dir: 'c', visibility: 'public' },
  ]), ['a', 'c']);
});
```

- [ ] **Step 3: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL with `Cannot find module` … `scripts/lib.mjs`.

- [ ] **Step 4: Write the implementation**

Create `scripts/lib.mjs`:

```js
const NAME_DATE = /^(?:.+-)?(\d{4}-\d{2}-\d{2})\.html$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export const decode = (s) => s
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&')
  .replace(/\s+/g, ' ').trim();

export const isEntryFile = (name) => name.endsWith('.html') && name !== 'index.html';

export const dateFromName = (file) => file.match(NAME_DATE)?.[1] ?? null;

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
  const dates = Object.fromEntries(Object.entries(data).filter(([, v]) => typeof v === 'string' && DAY.test(v)));
  return { dates, ok: true };
};

export const serializeDates = (dates) => {
  const sorted = Object.fromEntries(Object.entries(dates).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));
  return `${JSON.stringify(sorted, null, 2)}\n`;
};

export const titleOf = (html, file) => {
  for (const re of [/<h1[^>]*>([\s\S]*?)<\/h1>/i, /<title[^>]*>([\s\S]*?)<\/title>/i]) {
    const text = decode(html.match(re)?.[1] ?? '');
    if (text) return text;
  }
  return file.replace(/\.html$/, '');
};

export const topicsOf = (html) => {
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
```

- [ ] **Step 5: Run the tests to see them pass**

Run: `npm test`
Expected: PASS. The summary shows `# pass 16` and `# fail 0`.

- [ ] **Step 6: Stop and ask about a commit**

Ask the user: "Task 1 is done and the tests pass. Commit it?" Commit only on a clear yes:

```bash
git add scripts/lib.mjs scripts/lib.test.mjs package.json
git commit -m "Add tested helpers for entries, dates and sort order"
```

---

### Task 2: Config, icons, deploy list, and repo files

**Files:**
- Modify: `scripts/site-config.mjs` (whole file)
- Create: `assets/icons/route.svg`, `assets/icons/book.svg`, `assets/icons/chart.svg`
- Create: `scripts/public-dirs.mjs`
- Modify: `.github/workflows/deploy.yml:33-36` (the `mkdir _site` step)
- Modify: `package.json` (`name`)
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `publicDirs` from `scripts/lib.mjs` (Task 1).
- Produces:
  - `SITE = { title: 'DevLogs AI', slug: 'devlogs-ai-sumonta056', intro: string }`
  - Each `REPORTS` item has `dir`, `kind`, `title`, `short`, `visibility`, `color`, `on`, `ink`, `icon`, `about`, `tags`. `news` items also have `cadence`. The `roadmap` item has `order: string[]`.
  - `node scripts/public-dirs.mjs` prints the public dirs, separated by one space, on one line.

- [ ] **Step 1: Replace `scripts/site-config.mjs`**

```js
export const SITE = {
  title: 'DevLogs AI',
  slug: 'devlogs-ai-sumonta056',
  intro: 'A Claude agent writes a short news report on 3 topics each week. Next to the news are my learning guides and an AI coach roadmap. Pick a section below.',
};

export const PROFILE = {
  name: 'Sumonta Saha Mridul',
  initials: 'SM',
  photo: 'https://avatars.githubusercontent.com/u/61287791?v=4',
  role: 'Software Engineer at Cefalo',
  bio: 'I built a Claude agent that writes a weekly report on AI coding agents, Vue & Nuxt, and Java & Spring. I also keep my learning guides here: an AI coach roadmap, deep dives on databases, Git and Spring Boot, and notes on investing in Bangladesh.',
  links: [
    { label: 'GitHub', icon: 'github', href: '#' },
    { label: 'LinkedIn', icon: 'linkedin', href: '#' },
    { label: 'X', icon: 'x', href: '#' },
    { label: 'Email', icon: 'mail', href: '#' },
  ],
};

export const REPORTS = [
  {
    dir: 'ai-update-weekly',
    kind: 'news',
    title: 'AI Update (Agentic Dev)',
    short: 'AI Update',
    visibility: 'public',
    color: '#fcd34d', on: '#3d2e00', ink: '#8a6400',
    icon: 'sparkles',
    cadence: 'Every Sunday',
    about: "Every Sunday, my Claude agent collects the week's news on AI coding agents: new tools, real workflows, prompt tips, and the top GitHub projects.",
    tags: ['Coding agents', 'MCP', 'Prompting', 'GitHub picks'],
  },
  {
    dir: 'vue-nuxt-weekly-news',
    kind: 'news',
    title: 'Vue & Nuxt Weekly News',
    short: 'Vue & Nuxt',
    visibility: 'public',
    color: '#2b8a3e', on: '#ffffff', ink: '#237032',
    icon: 'vuedotjs',
    cadence: 'Every Tuesday',
    about: 'Every Tuesday, my Claude agent collects Vue 3 and Nuxt releases, upgrade guides, and patterns, with notes on what matters for real projects.',
    tags: ['Vue 3', 'Nuxt', 'Upgrades', 'Performance'],
  },
  {
    dir: 'java-spring-weekly-news',
    kind: 'news',
    title: 'Java & Spring Weekly News',
    short: 'Java & Spring',
    visibility: 'public',
    color: '#1c4fa0', on: '#ffffff', ink: '#1c4fa0',
    icon: 'openjdk',
    cadence: 'Every Thursday',
    about: 'Every Thursday, my Claude agent collects JDK and Spring Boot releases, backend practice, and performance notes for Java developers.',
    tags: ['Spring Boot', 'JDK', 'Virtual threads', 'Observability'],
  },
  {
    dir: 'ai-coach',
    kind: 'roadmap',
    title: 'AI Coach',
    short: 'AI Coach',
    visibility: 'public',
    color: '#7c3aed', on: '#ffffff', ink: '#6d28d9',
    icon: 'route',
    about: 'A step-by-step roadmap to learn Claude and Claude Code, from configuration basics to advanced agent workflows. Start at step 1.',
    tags: ['Claude Code', 'Agents', 'Configuration', 'Roadmap'],
    order: ['Inside Claude.html', 'More Advanced Claude Deep Dive.html'],
  },
  {
    dir: 'in-depth-learning',
    kind: 'guides',
    title: 'In-depth Learning',
    short: 'In-depth',
    visibility: 'public',
    color: '#0f766e', on: '#ffffff', ink: '#0f766e',
    icon: 'book',
    about: 'Long guides that go deep on one topic: databases, Git, SQL query tuning, and Spring Boot in production.',
    tags: ['Databases', 'SQL', 'Git', 'Spring Boot'],
  },
  {
    dir: 'investment-bd',
    kind: 'guides',
    title: 'Investment BD',
    short: 'Investment BD',
    visibility: 'public',
    color: '#be123c', on: '#ffffff', ink: '#9f1239',
    icon: 'chart',
    about: 'Beginner guides on how to invest in Bangladesh: savings, bonds, and the stock market.',
    tags: ['Investing', 'Stock market', 'Bangladesh', 'Basics'],
  },
  {
    dir: 'personal-guide',
    kind: 'guides',
    title: 'Personal Guide',
    short: 'Personal',
    visibility: 'private',
    color: '#6b7280', on: '#ffffff', ink: '#4b5563',
    icon: 'newspaper',
    about: 'Private notes. This page needs a login.',
    tags: [],
  },
];
```

- [ ] **Step 2: Add the 3 icons**

These are lucide-static v0.460.0 icons (`route`, `book-open`, `chart-line`), in the same format as `assets/icons/sparkles.svg`.

`assets/icons/route.svg`:

```xml
<!-- @license lucide-static v0.460.0 - ISC -->
<svg
  class="lucide lucide-route"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <circle cx="6" cy="19" r="3" />
  <path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15" />
  <circle cx="18" cy="5" r="3" />
</svg>
```

`assets/icons/book.svg`:

```xml
<!-- @license lucide-static v0.460.0 - ISC -->
<svg
  class="lucide lucide-book-open"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M12 7v14" />
  <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z" />
</svg>
```

`assets/icons/chart.svg`:

```xml
<!-- @license lucide-static v0.460.0 - ISC -->
<svg
  class="lucide lucide-chart-line"
  xmlns="http://www.w3.org/2000/svg"
  width="24"
  height="24"
  viewBox="0 0 24 24"
  fill="none"
  stroke="currentColor"
  stroke-width="2"
  stroke-linecap="round"
  stroke-linejoin="round"
>
  <path d="M3 3v16a2 2 0 0 0 2 2h16" />
  <path d="m19 9-5 5-4-4-3 3" />
</svg>
```

- [ ] **Step 3: Create `scripts/public-dirs.mjs`**

```js
import { REPORTS } from './site-config.mjs';
import { publicDirs } from './lib.mjs';

console.log(publicDirs(REPORTS).join(' '));
```

- [ ] **Step 4: Check the script output**

Run: `node scripts/public-dirs.mjs`
Expected, exactly: `ai-update-weekly vue-nuxt-weekly-news java-spring-weekly-news ai-coach in-depth-learning investment-bd`

- [ ] **Step 5: Change the deploy copy step**

In `.github/workflows/deploy.yml`, replace:

```yaml
      - run: |
          mkdir _site
          cp -r index.html robots.txt assets ai-update-weekly vue-nuxt-weekly-news java-spring-weekly-news _site/
          find _site -name .gitkeep -delete
```

with:

```yaml
      - run: |
          mkdir _site
          cp -r index.html robots.txt assets $(node scripts/public-dirs.mjs) _site/
          find _site -name .gitkeep -delete
```

- [ ] **Step 6: Do a dry run of the copy step**

Run:

```bash
S=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/site-dry && rm -rf "$S" && mkdir -p "$S" && cp -r index.html robots.txt assets $(node scripts/public-dirs.mjs) "$S"/ && ls "$S"
```

Expected: `ai-coach ai-update-weekly assets in-depth-learning index.html investment-bd java-spring-weekly-news robots.txt vue-nuxt-weekly-news`. The list must not contain `personal-guide`.

- [ ] **Step 7: Rename the package**

In `package.json`, change `"name": "reports-site"` to `"name": "devlogs-ai-sumonta056"`.

- [ ] **Step 8: Update `.gitignore`**

Replace the whole file with:

```
.vercel
node_modules
.DS_Store
/Icon?
```

- [ ] **Step 9: Check the ignore rules**

Run:

```bash
git check-ignore -v .DS_Store ai-coach/.DS_Store "$(printf 'Icon\r')"; echo "---"; git check-ignore -v assets/icons/route.svg assets/icons/book.svg; echo "exit=$?"
```

Expected: 3 lines before `---` (the 2 `.DS_Store` rules and the `/Icon?` rule). After `---`, no lines and `exit=1`. This proves that the new icons are not ignored.

- [ ] **Step 10: Run the tests again**

Run: `npm test`
Expected: PASS, `# fail 0`.

- [ ] **Step 11: Stop and ask about a commit**

Ask the user: "Task 2 is done. Commit it?" Commit only on a clear yes:

```bash
git add scripts/site-config.mjs scripts/public-dirs.mjs assets/icons/route.svg assets/icons/book.svg assets/icons/chart.svg .github/workflows/deploy.yml package.json .gitignore
git commit -m "Add learning sections to config and derive deploy folders from it"
```

---

### Task 3: Build script and styles

**Files:**
- Modify: `scripts/build-index.mjs` (whole file)
- Modify: `assets/site.css` (3 lines changed, 1 block added, 1 media rule extended)
- Create (by the build): `scripts/dates.json`
- Regenerated (by the build): `index.html` and `index.html` in each of the 7 section folders

**Interfaces:**
- Consumes: from `scripts/lib.mjs` (Task 1): `isEntryFile`, `resolveDate`, `parseDates`, `serializeDates`, `titleOf`, `topicsOf`, `sortEntries`, `entryHref`. From `scripts/site-config.mjs` (Task 2): `SITE`, `PROFILE`, `REPORTS`.
- Produces: HTML pages that use these CSS classes: `a-list`, `a-guide`, `a-steps`, `a-step`, `a-num`. Also `scripts/dates.json`.

The current file has 2 header comments. The new file has no comments, because the user rule forbids new comments and the old route list becomes wrong.

- [ ] **Step 1: Replace `scripts/build-index.mjs`**

```js
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SITE, PROFILE, REPORTS } from './site-config.mjs';
import {
  isEntryFile, resolveDate, parseDates, serializeDates, titleOf, topicsOf, sortEntries, entryHref,
} from './lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.BASE_PATH || '').replace(/\/+$/, '');
const DATES_FILE = join(ROOT, 'scripts/dates.json');

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

const readEntry = (r, file) => {
  const abs = join(ROOT, r.dir, file);
  const html = readFileSync(abs, 'utf8');
  const key = `${r.dir}/${file}`;
  const { date, source } = resolveDate(file, SAVED[key], statSync(abs).mtimeMs);
  if (source !== 'name') NEXT[key] = date;
  return { file, date, title: titleOf(html, file), topics: topicsOf(html) };
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
<meta name="description" content="${esc(description)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="${BASE}/assets/site.css">
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

const datesText = serializeDates(NEXT);
if (!existsSync(DATES_FILE) || readFileSync(DATES_FILE, 'utf8') !== datesText) writeFileSync(DATES_FILE, datesText);

console.log('Indexes rebuilt:', DATA.map((r) => `${r.dir}=${r.all.length}`).join(', '));
```

- [ ] **Step 2: Change 2 rules in `assets/site.css`**

Replace:

```css
.a-links{display:flex;gap:24px;overflow-x:auto;scrollbar-width:none}
```

with:

```css
.a-links{display:flex;gap:24px;overflow-x:auto;scrollbar-width:none;min-width:0}
```

Replace:

```css
.a-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:26px 0 8px}
```

with:

```css
.a-stats{display:grid;grid-template-columns:repeat(var(--n,4),minmax(0,1fr));gap:12px;margin:26px 0 8px}
```

- [ ] **Step 3: Add the guide and roadmap styles to `assets/site.css`**

Add this block directly after the `.a-empty{…}` line:

```css

.a-list{margin-top:22px}
.a-guide{grid-template-columns:minmax(0,1fr) auto}
.a-guide .a-meta{margin-top:8px}
.a-steps{list-style:none;margin:26px 0 0;padding:0}
.a-step{position:relative;display:grid;grid-template-columns:40px minmax(0,1fr);gap:14px}
.a-step+.a-step{margin-top:12px}
.a-step::before{content:"";position:absolute;left:19px;top:58px;bottom:-26px;width:2px;background:color-mix(in srgb,var(--c) 40%,var(--line))}
.a-step:last-child::before{display:none}
.a-num{position:relative;width:40px;height:40px;margin-top:14px;border-radius:50%;background:var(--c);color:var(--on);display:grid;place-items:center;font-weight:800;font-size:17px}
.a-step .a-row{margin:0}
```

- [ ] **Step 4: Extend the phone media rule in `assets/site.css`**

At the end of the `@media (max-width:640px){…}` line, put this text before the last `}`:

```css
.a-row.a-guide{grid-template-columns:minmax(0,1fr)}.a-step{grid-template-columns:32px minmax(0,1fr);gap:10px}.a-num{width:32px;height:32px;font-size:15px}.a-step::before{left:15px;top:50px}
```

- [ ] **Step 5: Run the first build**

Run: `npm run build`
Expected output, exactly 2 lines:

```
warn: scripts/dates.json not found, starting from {}
Indexes rebuilt: ai-update-weekly=2, vue-nuxt-weekly-news=1, java-spring-weekly-news=1, ai-coach=2, in-depth-learning=4, investment-bd=2, personal-guide=3
```

No `is not in order` warning and no `not found` warning for `ai-coach`.

- [ ] **Step 6: Check `scripts/dates.json`**

Run:

```bash
node -e 'const d=require("./scripts/dates.json");console.log(Object.keys(d).length, d["in-depth-learning/database-learning.html"], d["ai-update-weekly/Agentic Daily 4 Oct 2026.html"], d["ai-coach/Inside Claude.html"], "ai-update-weekly/agentic-daily-2026-09-27.html" in d)'
```

Expected: `14 2026-04-28 2026-10-04 2026-09-23 false`

- [ ] **Step 7: Check that a second build changes nothing**

Do this check in a scratch copy, so that `touch` does not change the modified time of your real file.

Run:

```bash
C=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/copy && rm -rf "$C" && rsync -a --exclude .git ./ "$C"/ && (cd "$C" && shasum scripts/dates.json index.html ai-coach/index.html > ../sum1 && touch in-depth-learning/database-learning.html && node scripts/build-index.mjs && shasum -c ../sum1)
```

Expected: the build prints only the `Indexes rebuilt:` line, with no warning. `shasum -c` prints `OK` for all 3 files. This proves that the saved date wins after `touch` changes the modified time.

- [ ] **Step 8: Check the page content**

Run:

```bash
grep -o 'Weekly news\|Learning</div>\|Roadmap</b> · 2 steps\|4 guides\|2 guides' index.html; grep -o 'Start here\|class="a-num">[0-9]' ai-coach/index.html; grep -o 'href="/vue-nuxt-weekly-news/Vue%20%26%20Nuxt%20Friday%20Brief.html"' vue-nuxt-weekly-news/index.html; grep -c 'Not placed yet' ai-coach/index.html; grep -o '<title>[^<]*' index.html
```

Expected:
1. `index.html` shows `Weekly news`, `Learning</div>`, `Roadmap</b> · 2 steps`, `4 guides`, and `2 guides`.
2. `ai-coach/index.html` shows `Start here`, `class="a-num">1`, and `class="a-num">2`.
3. The encoded Vue link prints once.
4. `0` for `Not placed yet`.
5. `<title>DevLogs AI`.

- [ ] **Step 9: Check error cases in a scratch copy**

Run:

```bash
C=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/copy && rm -rf "$C" && rsync -a --exclude .git ./ "$C"/ && rm -rf "$C/investment-bd" && printf '{oops' > "$C/scripts/dates.json" && node "$C/scripts/build-index.mjs"; grep -c 'No guides yet.' "$C/investment-bd/index.html"
```

Expected:
1. `warn: scripts/dates.json is not valid JSON, starting from {}`
2. An `Indexes rebuilt:` line that contains `investment-bd=0`.
3. `1` from `grep -c`.

The copy uses `rsync -a`, so modified times stay the same.

- [ ] **Step 10: Check the roadmap warnings in the scratch copy**

Run:

```bash
C=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/copy && sed -i '' "s/order: \['Inside Claude.html', 'More Advanced Claude Deep Dive.html'\]/order: ['Inside Claude.html', 'gone.html']/" "$C/scripts/site-config.mjs" && node "$C/scripts/build-index.mjs" 2>&1 | grep warn; grep -c 'Not placed yet' "$C/ai-coach/index.html"
```

Expected:
1. `warn: ai-coach/More Advanced Claude Deep Dive.html is not in order`
2. `warn: ai-coach order item gone.html not found`
3. `1` from `grep -c`.

- [ ] **Step 11: Run the tests again**

Run: `npm test`
Expected: PASS, `# fail 0`.

- [ ] **Step 12: Stop and ask about a commit**

Ask the user: "Task 3 is done. Commit the build, the styles, `scripts/dates.json`, and the regenerated index pages?" Commit only on a clear yes:

```bash
git add scripts/build-index.mjs assets/site.css scripts/dates.json index.html */index.html
git commit -m "Build guides and roadmap pages and freeze entry dates"
```

The new report files are not part of this commit. `scripts/publish.sh` or the user adds them later.

---

### Task 4: Browser check

**Files:** none changed. If a check fails, fix the code in the task that owns it, then run that task's checks again.

**Interfaces:**
- Consumes: the built pages from Task 3.
- Produces: nothing.

- [ ] **Step 1: Start a local server**

Run in the background: `python3 -m http.server 4173 --bind 127.0.0.1` in the repo root.

- [ ] **Step 2: Check the home page at desktop width (1280 px)**

Open `http://127.0.0.1:4173/`. Expected:
1. The nav shows `DevLogs AI`, Home, and 6 section links.
2. There are 4 stat boxes in one row.
3. The "Weekly news" label has 3 cards.
4. The "Learning" label has 3 cards: AI Coach (`Roadmap · 2 steps`), In-depth Learning (`4 guides · Latest: …`), and Investment BD (`2 guides · Latest: …`).
5. The side panel lists only the 3 news sections under "When the agent runs".
6. The console has no errors.

- [ ] **Step 3: Check one page of each kind**

1. Open `/ai-coach/`. Expected: 3 stat boxes in one row. Step 1 is "Claude Code: Configuration & Extensibility" with a `Start here` badge. Step 2 is "More Advanced Claude Deep Dive — Day 2". A line connects circle 1 and circle 2. No line goes below circle 2.
2. Open `/in-depth-learning/`. Expected: 3 stat boxes. 4 rows, newest first: the 2 rows from 5 Oct 2026, then the 2 rows from 28 Apr 2026. Each row shows `Added <date>`. There are no month headers.
3. Open `/java-spring-weekly-news/`. Expected: a month header "October 2026". The row from 4 Oct 2026 has the `New` badge.

- [ ] **Step 4: Check links with special characters**

1. On `/vue-nuxt-weekly-news/`, click "Vue & Nuxt Friday Brief". Expected: the report opens with no 404.
2. On `/in-depth-learning/`, click the Join Lab row (file `Join Lab_ Optimizing a 10-Table SQL Query.html`). Expected: the report opens with no 404.
3. On `/investment-bd/`, the Bengali text in the title of the investment guide row shows correctly, with no broken characters.

- [ ] **Step 5: Check phone width (375 px)**

Resize the window to 375 × 812 px. Expected:
1. On the home page, the nav link row scrolls left and right, and the page itself has no horizontal scroll.
2. The stats show 2 per row.
3. On `/ai-coach/`, the circles are 32 px, and the line still connects step 1 to step 2.
4. On `/in-depth-learning/`, the rows have no arrow and the text does not overflow.

- [ ] **Step 6: Check dark mode**

Switch the browser to the dark color scheme. Expected: on `/ai-coach/` and on the home page, the text, tags, and step line stay readable.

- [ ] **Step 7: Stop the server and report**

Stop the server. Report each check from Steps 2 to 6 to the user as pass or fail. For a failed check, include a screenshot.
