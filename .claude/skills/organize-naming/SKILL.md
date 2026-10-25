---
name: organize-naming
description: Rename the report and guide HTML files in a site folder (ai-coach, ai-update-weekly, in-depth-learning, and the others) to the site naming rules, then update scripts/site-config.mjs, scripts/dates.json, and the generated indexes. Use when the user runs /organize-naming <folder>, asks to "organize", "clean up", or "fix the naming" of a folder, or adds new HTML files with spaces, capitals, or other bad names. Run with no folder to check all folders.
---

# Organize naming

Each folder in `scripts/site-config.mjs` has a `kind`. The kind sets the naming rule.

## Rules

All names: lowercase, ASCII letters, digits and `-` only, ending `.html`. No spaces, `_`, `&`, em dashes, or double `-`.

| Kind | Pattern | Example |
|---|---|---|
| `roadmap` | `NN-topic.html`. `NN` is the 2-digit step number from the `order` list. | `03-session-3-ai-coaching.html` |
| `news` | `series-YYYY-MM-DD.html`. The series is the short report name. The date is the issue date. | `agentic-daily-2026-10-04.html` |
| `guides` | `topic.html`. If the file is about one date (a radar, a snapshot), add `-YYYY-MM-DD`. | `git-learning.html`, `job-radar-2026-10-04.html` |

Never rename `index.html` or `.gitkeep`.

Make the slug from the page `<title>` or `<h1>`. Drop filler words only when the name gets longer than 6 words. Keep numbers that carry meaning (`15-production-scenarios`). Take the date from `scripts/dates.json`. If there is no entry, take it from the file name or title. If you still have no date, ask the user.

## Steps

1. Read `scripts/site-config.mjs`. Find the folder entry and its `kind`. If the user gives no folder, check every folder in the config.
2. List the folder. Mark each file that breaks the rule. If all files match, report that and stop.
3. Show an `old → new` table. For a roadmap, also show the step order. Wait for the user to approve.
4. Rename. Use `git mv` for tracked files (`git ls-files <folder>`) and `mv` for untracked files. Quote names with spaces.
5. Update `scripts/dates.json`: move each old key to the new name and keep its date. Add an entry for a file that has no date. Keep the keys sorted.
6. For a roadmap, replace the folder `order` list in `scripts/site-config.mjs` with the new names, in step order. If the folder has a `titles` map, move each old key to the new name.
7. Delete `.DS_Store` in the folder.
8. Run `node scripts/build-index.mjs`. Then run `node --test scripts/`. Both must pass with no `not in order` or `not found` warnings.
9. Search the repo for each old name, plain and URL-encoded (`%20`), excluding `.git`. Fix live links. Leave page titles and test inputs in `scripts/lib.test.mjs` unchanged.
10. Report the renames and the changed files. Warn that old URLs now return "not found". Do not commit.
