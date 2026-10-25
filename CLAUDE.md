# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

"DevLogs AI": a static site of HTML reports and guides. A Claude agent writes weekly news reports; other pages are learning guides and an AI Coach roadmap. There is no framework and no npm dependencies: plain Node 20 scripts generate the index pages.

## Commands

```bash
npm run build                      # node scripts/build-index.mjs — regenerate all index pages and nav data
npm test                           # node --test scripts/lib.test.mjs
node --test --test-name-pattern="titleOf" scripts/lib.test.mjs   # one test
python3 -m http.server 4173        # preview locally at http://127.0.0.1:4173/
BASE_PATH=/sub npm run build       # build for a sub-path deploy (GitHub Pages sets this)
```

## Architecture

**Content vs generated files.** Each section folder (`ai-coach/`, `ai-update-weekly/`, …) holds self-contained HTML pages that are added by hand or by the agent. `scripts/build-index.mjs` generates everything else:
- `index.html` (home) and `<section>/index.html` for every section
- `assets/nav-data.json`, which the floating nav widget (`assets/nav-widget.js`) reads

Never hand-edit generated files. On a merge conflict in them, resolve the source files, then run `npm run build`.

**The build also edits content pages.** `readEntry` injects the nav widget `<script data-devlogs-nav>` before `</body>`, and `allowSelf` adds `'self'` to a page's CSP meta so that the widget can load. It keeps the file mtime.

**`scripts/site-config.mjs` is the single source of truth.** `SITE`, `PROFILE`, and `REPORTS` (one entry per section folder). Each report entry sets:
- `kind`: `news` (sorted newest first), `guides` (newest first, then title), or `roadmap` (fixed step order from `order`; files not in `order` warn and go last)
- `titles` (optional): display title per file, used before the page `<h1>`/`<title>`
- `visibility`: `private` sections are left out of the nav, the home page, and the GitHub Pages deploy
- `color` / `on` / `ink`: section color, text color on it, and accent text color. Keep `on` at 4.5:1 contrast or more.

Pure logic (sorting, title and date parsing, CSP patching, nav data) lives in `scripts/lib.mjs` and is what the tests cover.

**Entry dates** resolve in this order (`resolveDate` in `scripts/lib.mjs`): a `YYYY-MM-DD` in the file name, then `scripts/dates.json`, then file mtime. The build writes non-name dates back to `dates.json`, so a rename must move the `dates.json` key too.

## Naming conventions

File names are lowercase kebab-case and follow the section kind: roadmap `NN-topic.html`, news `series-YYYY-MM-DD.html`, guides `topic.html`. Use the `/organize-naming` skill (`.claude/skills/organize-naming/SKILL.md`) to rename. It also updates `dates.json`, `order`, and `titles`.

Display titles use a colon, not a dash, as the separator (for example `Session 1: Claude Code Configuration & Extensibility`).

## Deploy

- **GitHub Pages:** `.github/workflows/deploy.yml` runs on push to `main`. It builds with `BASE_PATH`, then copies only `index.html`, `robots.txt`, `assets/`, and the public dirs from `scripts/public-dirs.mjs`.
- **Private section:** `personal-guide/` is in `.gitignore` and is not in the public repo. It exists only on the local disk.
- **Auto-publish:** `scripts/publish.sh` rebuilds, commits, pulls, and pushes. `scripts/com.mridul.reports-publish.plist` is a launchd template that runs it when the news folders change. It still has `YOURNAME` placeholder paths.

A plugin hook blocks commits on `main` from Claude Code; the user runs those commits.
