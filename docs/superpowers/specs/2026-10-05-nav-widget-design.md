# Navigation widget on every report — design

Date: 2026-10-05
Status: Approved in chat, waiting for spec review
Builds on: `docs/superpowers/specs/2026-10-05-learning-sections-design.md`

## 1. Goal

A visitor who opens a report has no way back to the section list, home, or other reports. Add a small navigation button to every report HTML file, with no manual work. The owner drops HTML files into a section folder and publishes, as before.

Success: every report page shows the button. Its popup links to the section list, home, the other reports in the section, and the other sections. The report's own CSS and scripts do not break the widget, and the widget does not break the report.

## 2. Decisions

| Topic | Decision |
|---|---|
| Kind of widget | Navigation popup only. No AI, no server. |
| Position | Bottom-left. |
| Where the script line goes | Into the source report files. The build adds it. |
| Path of the script | Relative: `../assets/nav-widget.js`. Reports are always 1 folder deep. |
| Popup data | `assets/nav-data.json`, written by the build. Public sections only. |
| Isolation | Shadow DOM, very high `z-index`, no global CSS, no libraries. |

This spec replaces one rule of the earlier spec: "no change to report HTML files". The build now adds 1 line to each report.

## 3. Script line

```html
<script src="../assets/nav-widget.js" defer data-devlogs-nav></script>
```

- `data-devlogs-nav` is the marker. A file that contains the marker gets no change.
- The line goes directly before the last `</body>`, with any letter case. A file without `</body>` gets the line at its end.
- The build adds the line to each entry file (each `.html` except `index.html`) in each section, private sections included.
- The build reads the date of the file before it changes the file. Then it sets the original access and modified times back on the file.
- The build prints `Widget added: N file(s)` when N is more than 0.
- Section `index.html` pages do not get the line, because they have the site nav bar.

## 4. `assets/nav-data.json`

```json
{ "sections": [
  { "dir": "ai-coach", "short": "AI Coach", "color": "#7c3aed", "on": "#ffffff",
    "entries": [ { "file": "Inside Claude.html", "title": "…", "n": 1 }, … ] }
] }
```

- Only sections with `visibility: 'public'`, in config order.
- `entries` keep the page order of the section. Roadmap steps have `n` (1, 2, …). Files that are not in `order` come after the steps, with no `n`.
- The build writes the file only when its content changes.

## 5. Widget behavior

- The widget finds the site root from its own `src` (the folder above `assets/`). So it works on Vercel, on GitHub Pages under a sub-path, and locally.
- It finds the current section (first path part after the root) and file (second part, URL-decoded) from the page URL.
- Button: a 48 px circle, 16 px from the left and bottom edges, with the icon `☰`. It has the section color (`color` and `on`), or `#111` and `#fff` when the section is not in the data. `aria-label` and `title` are "Site menu".
- The popup opens above the button. It is 280 px wide, at most `100vw - 32px` wide, and at most 70vh high, and it scrolls when long. In this order, it contains:
  1. `← Back to <section short name>` (only when the page is in a section). For a section that is not in the data, the name is the folder name with `-` replaced by spaces.
  2. `⌂ Home`.
  3. "In this section": the entries of the current section. Roadmap steps show their number. The current file is bold and has a `●` mark.
  4. "Other sections": every other public section.
- The popup closes on Esc, on a click outside the widget, and on a second click on the button. When it opens, the focus goes to the first link. When Esc closes it, the focus goes back to the button. The button sets `aria-expanded`.
- If `nav-data.json` fails to load (for example over `file://`), the popup still shows items 1 and 2.
- Light and dark colors follow `prefers-color-scheme`. Print hides the widget.
- The widget runs only once per page, even if the script loads 2 times.

## 6. Files

| File | Change |
|---|---|
| `assets/nav-widget.js` | New. The widget. No libraries. |
| `assets/nav-data.json` | New. Written by the build. |
| `scripts/lib.mjs` | New pure functions `WIDGET_TAG`, `injectWidget(html)`, `navData(sections)`. |
| `scripts/lib.test.mjs` | Tests for the new functions. |
| `scripts/build-index.mjs` | Add the line to entry files, keep their times, write `nav-data.json`. |
| Report HTML files | 1 new line each, written by the build. |

No change: `publish.sh`, `deploy.yml`, `vercel.json`, `middleware.js`, `site.css`.

## 7. Error cases

| Case | Result |
|---|---|
| File already has the marker | No change. |
| No `</body>` | The line goes at the end. Browsers still run it. |
| `</body>` text also inside a script string earlier in the file | The line goes before the last `</body>`. |
| `nav-data.json` missing or broken | The popup shows Back and Home only. |
| The report has its own fixed element at bottom-left | The widget is on top (`z-index: 2147483647`). |

## 7a. Reports with a Content-Security-Policy meta tag

Found during implementation: the AI Coach decks (Claude artifact exports) have `<meta http-equiv="Content-Security-Policy" content="… script-src 'unsafe-inline'; connect-src 'none' …">`. This blocks `nav-widget.js` and the `nav-data.json` load.

Decision (owner approved): the build adds `'self'` to `script-src` and `connect-src` in that meta tag.
- A directive that already has `'self'` gets no change. `'none'` in that directive is replaced, because `'none'` cannot combine with other sources.
- A missing directive gets no change when `default-src` is missing or allows `'self'`. Otherwise the build adds the directive with the `default-src` sources (without `'none'`) plus `'self'`.
- Only the first CSP meta with a double-quoted `content` is changed. `Content-Security-Policy-Report-Only` is not changed.
- Known limit: a CSP without `style-src 'unsafe-inline'` shows the widget without styles.

## 8. Tests

Unit (`npm test`):
1. `injectWidget` adds the line once, directly before `</body>`.
2. `injectWidget` returns `null` when the marker is there.
3. It handles `</BODY>`.
4. It appends when there is no `</body>`.
5. It uses the last `</body>` when an earlier one is inside a script string.
6. `navData` keeps public sections only, numbers roadmap steps, leaves unplaced files without a number, and contains no private title.

Build checks:
1. A dry run in a scratch copy first. Every entry file has the marker exactly once, and the modified times do not change.
2. A second build adds nothing and changes no file.

Browser checks: the AI Coach file (1.5 MB), the Spring Boot report (heavy scripts), and one news report. Check that the button shows, that every popup link works, that the report CSS does not change the widget, and that Esc, outside click, phone width, and dark mode work.

## 9. Out of scope

- An AI chatbot.
- Search in the popup.
- Reports more than 1 folder deep.
