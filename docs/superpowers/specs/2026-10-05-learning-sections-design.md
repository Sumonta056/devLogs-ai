# Learning sections and DevLogs AI rename — design

Date: 2026-10-05
Status: Draft, waiting for review

## 1. Goal

The site shows only weekly news today. Add 3 learning sections, show all new files in the old sections, and give `ai-coach` a roadmap order. Rename the site to **DevLogs AI**.

Success: each HTML file in each section folder shows on the correct page, with a correct title, date, and order.

## 2. Current problems

1. `scripts/build-index.mjs` accepts only files named `YYYY-MM-DD.html` or `<prefix>-YYYY-MM-DD.html`. All 14 new files have no date in the name, so the site does not show them.
2. `scripts/site-config.mjs` does not list `ai-coach`, `in-depth-learning`, or `investment-bd`.
3. `.github/workflows/deploy.yml` lists the public folders by name in the copy step.
4. The site title, intro, and bio say "weekly" and "3 topics".
5. `.gitignore` does not ignore `.DS_Store` or `Icon\r`, so `publish.sh` (`git add -A`) commits them.

## 3. Decisions

| Topic | Decision |
|---|---|
| Section kinds | `news`, `guides`, `roadmap`. One field `kind` in each section config. |
| Roadmap order | An ordered list of file names (`order`) in the config. |
| Guide order | Newest first. One flat list with no month groups. |
| Date of an entry | Date in the file name, then `scripts/dates.json`, then local modified time. The build writes new dates to `dates.json` once and never changes them. |
| Privacy | The 3 new sections are public. `personal-guide` stays private. |
| `personal-guide` kind | `guides`. |
| Home page | 2 groups: "Weekly news" (`news`) and "Learning" (`guides` + `roadmap`). |
| Site name | Display title `DevLogs AI`. Slug `devlogs-ai-sumonta056` in `package.json`. |
| Build structure | One build script. One renderer for each kind. Pure functions in a separate module. |

Rejected: git commit dates. `publish.sh` builds before it commits, so a new file has no git date at build time. Vercel also makes a shallow clone.

## 4. Config

`scripts/site-config.mjs`:

```js
export const SITE = {
  title: 'DevLogs AI',
  slug: 'devlogs-ai-sumonta056',
  intro: '<new text: weekly news written by a Claude agent, plus learning guides and an AI coach roadmap>',
};
```

`PROFILE.bio` gets new text that names news and learning.

Each item in `REPORTS` gets `kind`. The new items are:

| dir | kind | short | icon (new file) | extra |
|---|---|---|---|---|
| `ai-coach` | `roadmap` | AI Coach | `route.svg` | `order: ['Inside Claude.html', 'More Advanced Claude Deep Dive.html']` |
| `in-depth-learning` | `guides` | In-depth | `book.svg` | — |
| `investment-bd` | `guides` | Investment BD | `chart.svg` | — |

Each new item also has `title`, `visibility: 'public'`, `color`, `on`, `ink`, `about`, and `tags`. A `cadence` value is needed only for `news`.

The 3 current news items get `kind: 'news'`. `personal-guide` gets `kind: 'guides'`.

## 5. Entry model

The build makes one entry from each `.html` file in a section folder, except `index.html`.

| Field | Source, in order |
|---|---|
| `file` | File name |
| `title` | `<h1>` text → `<title>` text → file name without `.html` |
| `topics` | `keywords` meta → first 4 `<h2>` texts |
| `date` | `YYYY-MM-DD` in file name → `dates.json["<dir>/<file>"]` → file modified time (local calendar day of the machine that runs the build) |

### 5.1 `scripts/dates.json`

- Shape: `{ "<dir>/<file>": "YYYY-MM-DD" }`, with keys sorted.
- The build adds a key when an entry gets its date from the modified time. It never changes a key that exists.
- The build does not add keys for files that have a date in the name.
- The build removes keys for files that no longer exist.
- If the file is missing or is not valid JSON, the build prints a warning and starts from `{}`.
- `publish.sh` commits it with the reports (`git add -A`).
- The first local build fills it from the current modified times.

## 6. Sort rules

| Kind | Order |
|---|---|
| `news` | Date, newest first. Ties: file name, Z→A. Grouped by month. |
| `guides` | Date, newest first. Ties: title, A→Z. No groups. |
| `roadmap` | Position in `order`. Then the files that are not in `order`, in the "Not placed yet" group, sorted by date, newest first. |

Warnings in the roadmap kind:
- A file that is not in `order`: `warn: ai-coach/<file> is not in order`.
- An `order` item with no file: `warn: ai-coach order item <file> not found`. The build skips it.

## 7. Pages

### 7.1 Home (`/`)

- Heading `DevLogs AI` and the new intro.
- Stats: issues published (`news` entries), guides (`guides` + `roadmap` entries, public only), last update, items this month.
- Label "Weekly news", then one card for each public `news` section. The meta text is the same as now.
- Label "Learning", then one card for each public `guides` or `roadmap` section.
  - `roadmap` meta: `Roadmap · N steps`.
  - `guides` meta: `N guides · Latest: <title>`.

### 7.2 News page

No change.

### 7.3 Guides page

- Breadcrumb, heading, and about text, the same as the news page.
- Stats: guides, last added, topics covered.
- A flat list. Each row has the title, tags, and the text `Added <d MMM yyyy>`. Rows have no "New" badge.
- Empty state: `No guides yet.`

### 7.4 Roadmap page

- Breadcrumb, heading, and about text.
- Stats: steps, topics covered, last added.
- A vertical step list. Each step has a number circle, a line to the next step, the title as a link, and tags. Step 1 has a `Start here` badge.
- The "Not placed yet" group comes after the steps. It shows only when it has entries. Its rows have no numbers.
- Empty state: `No steps yet.`

### 7.5 Shared parts

- Nav bar: Home plus one link for each public section, in config order. On narrow screens the link row scrolls left and right (`overflow-x: auto`). It has no menu button.
- Side panel: "When the agent runs" lists only `news` sections.
- The page `<title>` uses `SITE.title`.
- New CSS goes in `assets/site.css`. It uses the current `--c`, `--on`, and `--ink` color values.

## 8. Code structure

| File | Change |
|---|---|
| `scripts/lib.mjs` | New. Pure functions: `dateFromName`, `resolveDate`, `sortEntries(kind, entries, order)`, `titleOf(html, file)`, `topicsOf(html)`. No file system access. |
| `scripts/lib.test.mjs` | New. Tests for `lib.mjs` with `node:test`. |
| `scripts/build-index.mjs` | Scan all `.html` files. Read and write `dates.json`. One renderer for each kind. Home groups. |
| `scripts/public-dirs.mjs` | New. Prints the public `dir` values, separated by spaces. |
| `scripts/site-config.mjs` | New fields and new sections (section 4). |
| `scripts/dates.json` | New, made by the build. |
| `assets/site.css` | Styles for the roadmap step list, guide rows, and nav scroll. |
| `assets/icons/route.svg`, `book.svg`, `chart.svg` | New icons. |
| `.github/workflows/deploy.yml` | Copy step: `cp -r index.html robots.txt assets $(node scripts/public-dirs.mjs) _site/`. |
| `package.json` | `name: devlogs-ai-sumonta056`. Add script `test: node --test scripts/`. |
| `.gitignore` | Add `.DS_Store` and `/Icon?`. The `/` anchors the rule to the root, because macOS git ignores case and `Icon?` alone also matches `assets/icons`. |

No change: `middleware.js`, `vercel.json`, `publish.sh`, and all report HTML files.

## 9. Error cases

| Case | Result |
|---|---|
| Section folder is missing | Empty state on the page. The build continues. |
| No `<h1>` and no `<title>` | Title is the file name without `.html`. |
| `order` item has no file | Warning. The build skips it. |
| `dates.json` is missing or broken | Warning. The build starts from `{}`. |
| File name has spaces or `&` | The link uses `encodeURIComponent`. |

## 10. Tests

Unit tests (`npm test`):
1. `dateFromName` reads `agentic-daily-2026-09-27.html` and returns `null` for `Friday Java Brief.html`.
2. `resolveDate` uses the name first, then the map, then the modified time. It reports when it adds a new map key.
3. `sortEntries('roadmap', …)` follows `order`, puts other files in "Not placed yet", and reports missing `order` items.
4. `sortEntries('guides', …)` sorts newest first, with title ties A→Z.
5. `titleOf` falls back from `<h1>` to `<title>` to the file name.

Manual checks:
1. Run `npm run build`. Check that the output lists all 7 sections with the correct counts.
2. Serve the folder locally. Open the home page, one page of each kind, and one entry link that has spaces in its name.
3. Check the nav bar and the roadmap at 375 px width.
4. Check that `scripts/dates.json` has 14 keys, and that `in-depth-learning/database-learning.html` is `2026-04-28`.

## 11. Out of scope

- The GitHub repo rename. The owner does this on GitHub. A new repo name changes the GitHub Pages URL.
- "Mark step as done" on the roadmap.
- Changes to the report HTML files.
- The deletion of `untitled.md`.
