#!/usr/bin/env bash
# Copy the Launch Video Kit into a repo, so it works in cloud (web) sessions too:
# those don't load personal plugins, but they do load a repo's own .claude/ folder.
#
#   bash vendor-into-repo.sh /path/to/repo [videos-dir]     (default videos-dir: marketing/launch-video)
set -euo pipefail
KIT="$(cd "$(dirname "$0")/.." && pwd)"
REPO="${1:?usage: vendor-into-repo.sh /path/to/repo [videos-dir]}"
DIR="${2:-marketing/launch-video}"
mkdir -p "$REPO/.claude/skills" "$REPO/.claude/agents"
cp -R "$KIT/skills/launch-video" "$REPO/.claude/skills/"
cp "$KIT"/agents/*.md "$REPO/.claude/agents/"
if [ -e "$REPO/$DIR" ]; then
  echo "skip: $REPO/$DIR already exists (engine not copied)"
else
  mkdir -p "$(dirname "$REPO/$DIR")" && cp -R "$KIT/template" "$REPO/$DIR"
  echo "engine -> $REPO/$DIR"
fi
# the vendored skill points at the vendored engine, not the plugin
awk -v dir="$DIR" '
  /<!-- scaffold -->/ { print "  Already vendored: the engine is in `" dir "`. Work there."; skip = 1; next }
  /<!-- \/scaffold -->/ { skip = 0; next }
  !skip' "$REPO/.claude/skills/launch-video/SKILL.md" > "$REPO/.claude/skills/launch-video/SKILL.md.tmp"
mv "$REPO/.claude/skills/launch-video/SKILL.md.tmp" "$REPO/.claude/skills/launch-video/SKILL.md"
echo "skill + agents -> $REPO/.claude/  (commit them)"
