# Navigation Widget Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a bottom-left navigation button with a popup to every report HTML file, added automatically by the build.

**Architecture:** The build adds 1 relative `<script>` line (with a marker) to each report and writes `assets/nav-data.json` with public sections and their entries. `assets/nav-widget.js` finds the site root from its own `src`, reads the data, and draws the button and popup inside a Shadow DOM.

**Tech Stack:** Node 20 ESM, `node:test`, plain browser JavaScript (no libraries).

**Spec:** `docs/superpowers/specs/2026-10-05-nav-widget-design.md`

## Global Constraints

- No npm dependencies. No browser libraries.
- No code comments (user rule).
- No `git commit` or `git push` without the user's yes.
- Script line, exactly: `<script src="../assets/nav-widget.js" defer data-devlogs-nav></script>`
- Marker: `data-devlogs-nav`.
- `nav-data.json` contains public sections only.
- The build keeps the original access and modified times of each report it changes.
- Widget `z-index: 2147483647`. Button 48 px, 16 px from left and bottom.
- Labels, exactly: `Site menu`, `← Back to <short>`, `⌂ Home`, `In this section`, `Other sections`.

## Review Focus

1. A report whose CSS sets global `button`, `a`, `ul`, or `*` styles. The widget must look the same. Task 3 checks it on 3 different reports.
2. A report that already has the line (second build, CI build). It must not change. Task 1 tests it. Task 2 checks a second build.
3. File times after injection. `dates.json` must not change, and new files must still get their real date. Task 2 checks times before and after.
4. The site under a sub-path (GitHub Pages). Links must keep the sub-path. Task 3 serves the site under `/sub/`.
5. A private Personal Guide page. The popup must not list private files, and public data must not contain private titles. Task 1 tests `navData`. Task 3 opens a Personal Guide page.

---

### Task 1: Pure functions with tests

**Files:**
- Modify: `scripts/lib.mjs` (append)
- Modify: `scripts/lib.test.mjs` (import line and new tests)

**Interfaces:**
- Produces:
  - `WIDGET_TAG: string` (the exact script line)
  - `injectWidget(html: string): string | null` — `null` means no change.
  - `navData(sections): { sections: { dir, short, color, on, entries: { file, title, n? }[] }[] }`. Input items have `dir, short, color, on, kind, visibility, entries: Entry[], unplaced: Entry[]`.

- [ ] **Step 1: Write the failing tests**

In `scripts/lib.test.mjs`, change the import list to also import `WIDGET_TAG, injectWidget, navData`:

```js
import {
  decode, isEntryFile, dateFromName, localDay, resolveDate, parseDates, serializeDates,
  titleOf, topicsOf, sortEntries, entryHref, publicDirs, WIDGET_TAG, injectWidget, navData,
} from './lib.mjs';
```

Append at the end of the file:

```js
test('injectWidget adds the line once, before </body>', () => {
  assert.equal(
    injectWidget('<html><body><p>x</p></body></html>'),
    `<html><body><p>x</p>${WIDGET_TAG}\n</body></html>`,
  );
});

test('injectWidget makes no change when the marker is there', () => {
  const once = injectWidget('<body></body>');
  assert.equal(injectWidget(once), null);
});

test('injectWidget handles an upper-case body tag', () => {
  assert.equal(injectWidget('<BODY>x</BODY>'), `<BODY>x${WIDGET_TAG}\n</BODY>`);
});

test('injectWidget appends when there is no body end tag', () => {
  assert.equal(injectWidget('<p>x</p>'), `<p>x</p>\n${WIDGET_TAG}\n`);
});

test('injectWidget uses the last body end tag', () => {
  const html = '<script>const s = "</body>";</script><body>x</body>';
  assert.equal(injectWidget(html), `<script>const s = "</body>";</script><body>x${WIDGET_TAG}\n</body>`);
});

test('navData keeps public sections, numbers roadmap steps, hides private titles', () => {
  const data = navData([
    {
      dir: 'ai-coach', short: 'AI Coach', color: '#7c3aed', on: '#ffffff', kind: 'roadmap', visibility: 'public',
      entries: [entry('b.html', '2026-10-02', 'Two'), entry('a.html', '2026-09-23', 'One')],
      unplaced: [entry('c.html', '2026-01-01', 'Extra')],
    },
    {
      dir: 'news', short: 'News', color: '#111111', on: '#ffffff', kind: 'news', visibility: 'public',
      entries: [entry('n.html', '2026-10-04', 'Daily')], unplaced: [],
    },
    {
      dir: 'personal-guide', short: 'Personal', color: '#6b7280', on: '#ffffff', kind: 'guides', visibility: 'private',
      entries: [entry('secret.html', '2026-10-04', 'Job Radar')], unplaced: [],
    },
  ]);
  assert.deepEqual(data, {
    sections: [
      {
        dir: 'ai-coach', short: 'AI Coach', color: '#7c3aed', on: '#ffffff',
        entries: [{ file: 'b.html', title: 'Two', n: 1 }, { file: 'a.html', title: 'One', n: 2 }, { file: 'c.html', title: 'Extra' }],
      },
      { dir: 'news', short: 'News', color: '#111111', on: '#ffffff', entries: [{ file: 'n.html', title: 'Daily' }] },
    ],
  });
  assert.ok(!JSON.stringify(data).includes('Job Radar'));
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `npm test`
Expected: FAIL. The import of `WIDGET_TAG` fails with `does not provide an export named`.

- [ ] **Step 3: Write the implementation**

Append to `scripts/lib.mjs`:

```js
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
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `npm test`
Expected: PASS, `# pass 26`, `# fail 0`.

---

### Task 2: Widget script and build wiring

**Files:**
- Create: `assets/nav-widget.js`
- Modify: `scripts/build-index.mjs` (imports, `readEntry`, file writes at the end)
- Created by the build: `assets/nav-data.json`
- Changed by the build: each report HTML file (1 line)

**Interfaces:**
- Consumes: `WIDGET_TAG`, `injectWidget`, `navData` from Task 1.
- Produces: `assets/nav-data.json` in the Task 1 `navData` shape. The widget reads it from `<root>assets/nav-data.json`.

- [ ] **Step 1: Create `assets/nav-widget.js`**

```js
(() => {
  const script = document.currentScript;
  if (!script || document.querySelector('[data-devlogs-nav-host]')) return;

  const root = new URL('..', new URL('.', script.src)).href;
  const parts = location.href.startsWith(root) ? location.href.slice(root.length).split(/[?#]/)[0].split('/') : [];
  const dir = parts.length > 1 ? parts[0] : '';
  const file = parts.length > 1 ? decodeURIComponent(parts[1]) : '';
  const href = (d, f) => `${root}${d}/${f ? encodeURIComponent(f) : ''}`;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  const css = `
:host{all:initial}
*{box-sizing:border-box;margin:0;padding:0}
.btn{position:fixed;left:16px;bottom:16px;z-index:2147483647;width:48px;height:48px;border-radius:50%;border:0;cursor:pointer;background:var(--c,#111);color:var(--on,#fff);font:600 22px/1 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.25)}
.btn:focus-visible{outline:3px solid #3b82f6;outline-offset:2px}
.panel{position:fixed;left:16px;bottom:76px;z-index:2147483647;width:280px;max-width:calc(100vw - 32px);max-height:70vh;overflow:auto;padding:10px;border-radius:14px;background:#fff;color:#111;border:1px solid #e6e6e0;box-shadow:0 12px 32px rgba(0,0,0,.18);font:14px/1.4 system-ui,sans-serif;text-align:left}
.panel[hidden]{display:none}
a{display:flex;gap:8px;align-items:center;padding:7px 8px;border-radius:8px;color:inherit;text-decoration:none}
a:hover,a:focus-visible{background:#f3f3ef;outline:none}
.back{font-weight:700;font-size:15px}
h2{font:700 11px/1 system-ui,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#666;margin:12px 8px 4px}
ul{list-style:none}
b{flex:none;width:20px;height:20px;border-radius:50%;background:var(--c,#111);color:var(--on,#fff);font-size:11px;display:grid;place-items:center}
span{flex:1;min-width:0}
[aria-current]{font-weight:700}
[aria-current]::after{content:"\\25CF";color:var(--c,#111)}
@media (prefers-color-scheme:dark){.panel{background:#151515;color:#f3f3f3;border-color:#262626}a:hover,a:focus-visible{background:#1b1b1b}h2{color:#9a9a9a}}
@media print{.btn,.panel{display:none!important}}`;

  const host = document.createElement('div');
  host.setAttribute('data-devlogs-nav-host', '');
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `<style>${css}</style><nav class="panel" id="p" hidden></nav><button type="button" class="btn" aria-label="Site menu" title="Site menu" aria-expanded="false" aria-controls="p">&#9776;</button>`;
  document.body.appendChild(host);
  const btn = shadow.querySelector('.btn');
  const panel = shadow.querySelector('.panel');

  const render = (data) => {
    const sections = (data && data.sections) || [];
    const cur = sections.find((s) => s.dir === dir);
    if (cur) {
      host.style.setProperty('--c', cur.color);
      host.style.setProperty('--on', cur.on);
    }
    const name = cur ? cur.short : dir.replace(/-/g, ' ');
    let html = dir ? `<a class="back" href="${href(dir)}">&larr; Back to ${esc(name)}</a>` : '';
    html += `<a href="${root}">&#8962; Home</a>`;
    if (cur && cur.entries.length) {
      html += `<h2>In this section</h2><ul>${cur.entries.map((e) => `<li><a href="${href(dir, e.file)}"${e.file === file ? ' aria-current="page"' : ''}>${e.n ? `<b>${e.n}</b>` : ''}<span>${esc(e.title)}</span></a></li>`).join('')}</ul>`;
    }
    const others = sections.filter((s) => s.dir !== dir);
    if (others.length) {
      html += `<h2>Other sections</h2><ul>${others.map((s) => `<li><a href="${href(s.dir)}">${esc(s.short)}</a></li>`).join('')}</ul>`;
    }
    panel.innerHTML = html;
  };

  const setOpen = (open) => {
    panel.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    if (open) panel.querySelector('a')?.focus();
  };

  btn.addEventListener('click', () => setOpen(panel.hidden));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !panel.hidden) {
      setOpen(false);
      btn.focus();
    }
  });
  document.addEventListener('click', (e) => {
    if (!panel.hidden && !e.composedPath().includes(host)) setOpen(false);
  });

  render(null);
  fetch(`${root}assets/nav-data.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d && render(d))
    .catch(() => {});
})();
```

- [ ] **Step 2: Change the imports in `scripts/build-index.mjs`**

Replace:

```js
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync } from 'node:fs';
```

with:

```js
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync, mkdirSync, utimesSync } from 'node:fs';
```

Replace:

```js
  isEntryFile, resolveDate, parseDates, serializeDates, titleOf, topicsOf, sortEntries, entryHref,
} from './lib.mjs';
```

with:

```js
  isEntryFile, resolveDate, parseDates, serializeDates, titleOf, topicsOf, sortEntries, entryHref,
  injectWidget, navData,
} from './lib.mjs';
```

- [ ] **Step 3: Replace `readEntry` in `scripts/build-index.mjs`**

Replace:

```js
const readEntry = (r, file) => {
  const abs = join(ROOT, r.dir, file);
  const html = readFileSync(abs, 'utf8');
  const key = `${r.dir}/${file}`;
  const { date, source } = resolveDate(file, SAVED[key], statSync(abs).mtimeMs);
  if (source !== 'name') NEXT[key] = date;
  return { file, date, title: titleOf(html, file), topics: topicsOf(html) };
};
```

with:

```js
let added = 0;

const readEntry = (r, file) => {
  const abs = join(ROOT, r.dir, file);
  const html = readFileSync(abs, 'utf8');
  const st = statSync(abs);
  const key = `${r.dir}/${file}`;
  const { date, source } = resolveDate(file, SAVED[key], st.mtimeMs);
  if (source !== 'name') NEXT[key] = date;
  const withWidget = injectWidget(html);
  if (withWidget !== null) {
    writeFileSync(abs, withWidget);
    utimesSync(abs, st.atime, st.mtime);
    added += 1;
  }
  return { file, date, title: titleOf(html, file), topics: topicsOf(html) };
};
```

- [ ] **Step 4: Replace the file writes at the end of `scripts/build-index.mjs`**

Replace:

```js
const datesText = serializeDates(NEXT);
if (!existsSync(DATES_FILE) || readFileSync(DATES_FILE, 'utf8') !== datesText) writeFileSync(DATES_FILE, datesText);

console.log('Indexes rebuilt:', DATA.map((r) => `${r.dir}=${r.all.length}`).join(', '));
```

with:

```js
const writeIfChanged = (path, text) => {
  if (!existsSync(path) || readFileSync(path, 'utf8') !== text) writeFileSync(path, text);
};
writeIfChanged(DATES_FILE, serializeDates(NEXT));
writeIfChanged(join(ROOT, 'assets/nav-data.json'), `${JSON.stringify(navData(DATA))}\n`);

console.log('Indexes rebuilt:', DATA.map((r) => `${r.dir}=${r.all.length}`).join(', '));
if (added) console.log(`Widget added: ${plural(added, 'file')}`);
```

- [ ] **Step 5: Run the tests**

Run: `npm test`
Expected: PASS, `# pass 26`, `# fail 0`.

- [ ] **Step 6: Do a dry run in a scratch copy**

Run:

```bash
C=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/nav-copy && rm -rf "$C" && rsync -a --exclude .git --exclude .superpowers ./ "$C"/ && cd "$C" && find . -path ./docs -prune -o -name '*.html' ! -name index.html -print0 | xargs -0 stat -f '%m %N' | sort > ../times1 && node scripts/build-index.mjs && find . -path ./docs -prune -o -name '*.html' ! -name index.html -print0 | xargs -0 stat -f '%m %N' | sort > ../times2 && diff ../times1 ../times2 && echo "times same" && find . -path ./docs -prune -o -name '*.html' ! -name index.html -print0 | xargs -0 grep -c 'data-devlogs-nav' | grep -v ':1$'; echo "bad-count-exit=$?"; node scripts/build-index.mjs; grep -c 'Job Radar\|linkedin-plan\|youtube-plan' assets/nav-data.json
```

Expected:
1. `Indexes rebuilt: …` and then `Widget added: 15 files`.
2. `times same`.
3. `bad-count-exit=1`, which means every report has the marker exactly once.
4. The second build prints only `Indexes rebuilt: …`, with no `Widget added` line.
5. `0` from the private-name check.

- [ ] **Step 7: Run the real build**

Run: `npm run build && git diff --stat -- scripts/dates.json && git status --short -- '*.html' | grep -v index.html | head -20`
Expected:
1. `Widget added: 15 files`.
2. No change in `scripts/dates.json`.
3. Only `ai-update-weekly/agentic-daily-2026-09-27.html` shows as ` M`, because it is the only committed report. The other reports are still untracked (`??`).

- [ ] **Step 8: Stop and ask about a commit**

Ask the user before any commit.

---

### Task 3: Browser checks

**Files:** none. Fix code in the owning task if a check fails.

- [ ] **Step 1: Serve the site at the root and under a sub-path**

Run in the background: `python3 -m http.server 4173 --bind 127.0.0.1` in the repo root.
Run: `S=/private/tmp/claude-502/-Users-cefalo-1-Documents-Projects-weekly-report/153edc32-e2df-43f2-9ece-266e19a49811/scratchpad/subsite && rm -rf "$S" && mkdir -p "$S" && ln -s /Users/cefalo_1/Documents/Projects/weekly-report "$S/sub"`, then serve `$S` in the background on port 4174.

- [ ] **Step 2: Check 3 reports at 1280 px**

Open each of these:
- `http://127.0.0.1:4173/ai-coach/Inside%20Claude.html`
- `http://127.0.0.1:4173/in-depth-learning/Spring%20Boot%20under%20pressure_%2015%20production%20scenarios.html`
- `http://127.0.0.1:4173/java-spring-weekly-news/Friday%20Java%20Brief.html`

Expected on each:
1. A 48 px round button at bottom-left, in the section color.
2. A click opens the popup with `← Back to <section>`, `⌂ Home`, "In this section" with the current file bold and marked `●`, and "Other sections".
3. On AI Coach, the steps show `1` and `2`.
4. Esc closes the popup, and the focus goes back to the button. An outside click closes it. A second button click closes it.
5. Each link in the popup opens a page with HTTP 200.
6. The console shows no error from `nav-widget.js`.

- [ ] **Step 3: Check the sub-path**

Open `http://127.0.0.1:4174/sub/ai-coach/Inside%20Claude.html`. Expected: every popup link starts with `http://127.0.0.1:4174/sub/`, and the popup shows "In this section", which proves that `nav-data.json` loaded.

- [ ] **Step 4: Check a private page**

Open `http://127.0.0.1:4173/personal-guide/linkedin-plan.html`. Expected: `← Back to personal guide`, `⌂ Home`, and "Other sections". There is no "In this section" list.

- [ ] **Step 5: Check phone width and dark mode**

At 375 × 812 px, the popup fits inside the screen, and the button does not cover the popup. In dark mode, the popup is dark and readable.

- [ ] **Step 6: Stop the servers and report**

Stop both servers. Report each check as pass or fail. For a failed check, include a screenshot.
