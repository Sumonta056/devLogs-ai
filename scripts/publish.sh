#!/bin/bash
# Rebuild index pages, commit any new/changed reports, push → Vercel redeploys.
# Run manually (./scripts/publish.sh) or automatically via the launchd watcher.
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"   # launchd has a minimal PATH

# Give the writer a moment to finish (launchd fires on first file change)
sleep 5

node scripts/build-index.mjs

git add -A
if git diff --cached --quiet; then
  echo "$(date '+%F %T') nothing to publish"
  exit 0
fi

NEW=$(git diff --cached --name-only --diff-filter=A | grep -E '\.html$' | grep -v 'index.html' | tr '\n' ' ' || true)
git commit -m "report: ${NEW:-update indexes}"
git pull --rebase --quiet
git push --quiet
echo "$(date '+%F %T') published: ${NEW}"
