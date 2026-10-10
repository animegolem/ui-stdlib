#!/usr/bin/env bash
# workspace-create.sh — create an independent-clone workspace entry.
#
# Usage: workspace-create.sh <canonical-repo-root> <role>/<id>
#   e.g.: workspace-create.sh /path/to/repo code-lead/primary
#
# Deterministic, low-freedom recipe (2026-08-08 two-lead consultation):
# resolve and validate the canonical root and the target descendant,
# REFUSE an existing target, clone --no-hardlinks to a temporary
# sibling, verify the entry's git common-dir is independent, then
# rename into place. There is deliberately NO cleanup subcommand:
# workspace cleanup is Review Lead-only, one resolved descendant at a
# time, never the root, never a glob — and never `git clean -x` in the
# canonical root.
#
# Concurrency boundary: collaborating leads may race to create files, but are
# trusted not to swap verified repository directories for links mid-command.
# Existing and dangling links are rejected before any clone/write, the staging
# directory is private, and publication is one same-parent rename. This is not
# presented as a defence against a malicious local user with write access.
set -euo pipefail

die() { echo "workspace-create: ERROR $*" >&2; exit 2; }

[[ $# -eq 2 ]] || die "usage: workspace-create.sh <canonical-repo-root> <role>/<id>"

canonical="$(cd "$1" 2>/dev/null && pwd -P)" || die "canonical root does not resolve: $1"
[[ -d "$canonical/.git" ]] || die "not a repository root (no .git): $canonical"
case "$canonical" in
  */.workspaces/*) die "canonical root may not itself be a workspace entry: $canonical" ;;
esac

entry="$2"
if [[ ! "$entry" =~ ^([a-z0-9][a-z0-9_-]*)/([a-z0-9][a-z0-9_-]*)$ ]]; then
  die "target must be exactly two lowercase-safe segments <role>/<id> with no control characters: $entry"
fi
role="${BASH_REMATCH[1]}"
identifier="${BASH_REMATCH[2]}"

assert_safe_directory() {
  local path="$1" label="$2" physical
  [[ ! -L "$path" ]] || die "$label cannot be a symbolic link: $path"
  [[ -d "$path" ]] || die "$label must be a directory: $path"
  physical="$(cd "$path" && pwd -P)" || die "$label does not resolve: $path"
  case "$physical" in
    "$canonical"|"$canonical"/*) ;;
    *) die "$label resolves outside the canonical repository: $physical" ;;
  esac
}

workspaces="$canonical/.workspaces"
if [[ -e "$workspaces" || -L "$workspaces" ]]; then
  assert_safe_directory "$workspaces" ".workspaces"
else
  mkdir "$workspaces" || die "cannot create .workspaces"
  assert_safe_directory "$workspaces" ".workspaces"
fi

role_dir="$workspaces/$role"
if [[ -e "$role_dir" || -L "$role_dir" ]]; then
  assert_safe_directory "$role_dir" "workspace role directory"
else
  mkdir "$role_dir" || die "cannot create workspace role directory: $role_dir"
  assert_safe_directory "$role_dir" "workspace role directory"
fi

# Publication is derived only from the two validated segments. The raw caller
# string never regains path authority after validation.
target="$role_dir/$identifier"
[[ ! -e "$target" && ! -L "$target" ]] \
  || die "target exists (including a dangling link); this tool never overwrites: $target"

grep -qxF '.workspaces/' "$canonical/.gitignore" 2>/dev/null \
  || die ".workspaces/ is not in $canonical/.gitignore — add it first (bootstrap step)"

stage="$(mktemp -d "$role_dir/.${identifier}.stage.XXXXXX")" \
  || die "cannot create private staging directory"
tmp="$stage/clone"
cleanup() { rm -rf -- "$stage"; }
trap cleanup EXIT

git -C "$canonical" show-ref --verify --quiet refs/heads/main \
  || die "canonical repository has no local main branch"
main_sha="$(git -C "$canonical" rev-parse refs/heads/main)"

git clone --no-hardlinks --branch main --single-branch "$canonical" "$tmp" >/dev/null 2>&1 \
  || die "clone failed"

common_dir="$(git -C "$tmp" rev-parse --git-common-dir)"
case "$common_dir" in
  .git|"$tmp"/.git) ;;
  *) die "clone common-dir escapes the entry ($common_dir) — refusing" ;;
esac

[[ "$(git -C "$tmp" branch --show-current)" == "main" ]] \
  || die "clone did not check out main"
[[ "$(git -C "$tmp" rev-parse HEAD)" == "$main_sha" ]] \
  || die "clone base does not match canonical main"

[[ ! -e "$target" && ! -L "$target" ]] \
  || die "target appeared during construction; refusing publication: $target"
mv "$tmp" "$target"
assert_safe_directory "$target" "published workspace"
trap - EXIT
rmdir "$stage"
echo "workspace-create: OK $target"
echo "  branch: $(git -C "$target" branch --show-current)"
echo "  origin: $(git -C "$target" remote get-url origin)"
