#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
root="$(mktemp -d "${TMPDIR:-/tmp}/ui-workspace-create.XXXXXX")"
trap 'rm -rf "$root"' EXIT

canonical="$root/repo"
git init -q -b main "$canonical"
git -C "$canonical" config user.email test@example.invalid
git -C "$canonical" config user.name "ui-stdlib test"
printf '.workspaces/\n' > "$canonical/.gitignore"
git -C "$canonical" add .gitignore
git -C "$canonical" commit -qm main
main_sha="$(git -C "$canonical" rev-parse HEAD)"

git -C "$canonical" switch -qc review-branch
printf 'review only\n' > "$canonical/review.txt"
git -C "$canonical" add review.txt
git -C "$canonical" commit -qm review

bash "$SCRIPT_DIR/workspace-create.sh" "$canonical" code-lead/test >/dev/null
workspace="$canonical/.workspaces/code-lead/test"
[[ "$(git -C "$workspace" branch --show-current)" == main ]]
[[ "$(git -C "$workspace" rev-parse HEAD)" == "$main_sha" ]]
[[ ! -e "$workspace/review.txt" ]]

outside="$root/outside"
mkdir "$outside"
ln -s "$outside" "$canonical/.workspaces/review-lead"
if bash "$SCRIPT_DIR/workspace-create.sh" "$canonical" review-lead/escape >/dev/null 2>&1; then
  echo "workspace-create smoke: symlinked parent unexpectedly accepted" >&2
  exit 1
fi
[[ ! -e "$outside/escape" ]]

ln -s "$root/missing" "$canonical/.workspaces/dangling"
if bash "$SCRIPT_DIR/workspace-create.sh" "$canonical" dangling/escape >/dev/null 2>&1; then
  echo "workspace-create smoke: dangling parent unexpectedly accepted" >&2
  exit 1
fi
[[ ! -e "$root/missing" ]]

mkdir "$canonical/.workspaces/code-lead/"$'probe\n'
multiline_entry=$'code-lead/probe\n/../../../../outside'
if bash "$SCRIPT_DIR/workspace-create.sh" "$canonical" "$multiline_entry" >/dev/null 2>&1; then
  echo "workspace-create smoke: multiline target unexpectedly accepted" >&2
  exit 1
fi
[[ ! -e "$outside/.git" ]]

for invalid_entry in $'code-lead/probe\r' code-lead/extra/segment code-lead/trailing/ /code-lead/leading; do
  if bash "$SCRIPT_DIR/workspace-create.sh" "$canonical" "$invalid_entry" >/dev/null 2>&1; then
    echo "workspace-create smoke: invalid target grammar unexpectedly accepted" >&2
    exit 1
  fi
done
[[ ! -e "$outside/.git" ]]
[[ -z "$(find "$canonical/.workspaces/code-lead" -maxdepth 1 -name '.*.stage.*' -print -quit)" ]]

echo "workspace-create smoke: PASS"
