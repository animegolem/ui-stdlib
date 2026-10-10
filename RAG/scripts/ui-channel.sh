#!/usr/bin/env bash
# Repo-local carrier wrapper. It installs no watcher, daemon, hook, or host
# setting; callers explicitly sync, inspect, and digest-ACK mailbox events.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd -P)"

if [[ $# -lt 1 ]]; then
  echo "usage: bash RAG/scripts/ui-channel.sh <carrier-command> [args...]" >&2
  exit 2
fi

command_name="$1"
shift

# The wrapper owns repository identity. argparse historically accepted a later
# --repo (and the --rep abbreviation), splitting artifacts from the index.
# Refuse every spelling it previously accepted instead of forwarding a second
# authority declaration.
for argument in "$@"; do
  case "$argument" in
    --repo|--repo=*|--rep|--rep=*)
      echo "ui-channel: ERROR repository identity is bound by the wrapper; caller --repo overrides are forbidden" >&2
      exit 2
      ;;
  esac
done

channel="$REPO_ROOT/.codex"
if [[ -L "$channel" ]]; then
  echo "ui-channel: ERROR channel root cannot be a symbolic link: $channel" >&2
  exit 2
fi
if [[ -e "$channel" && ! -d "$channel" ]]; then
  echo "ui-channel: ERROR channel root is not a directory: $channel" >&2
  exit 2
fi
if [[ ! -e "$channel" ]]; then
  mkdir "$channel"
fi
channel_real="$(cd "$channel" && pwd -P)"
case "$channel_real" in
  "$REPO_ROOT/.codex") ;;
  *)
    echo "ui-channel: ERROR channel root escapes the bound repository: $channel_real" >&2
    exit 2
    ;;
esac

export CARRIER_CHANNEL=".codex"
export CARRIER_STATE_DIR="$REPO_ROOT/.codex/state"
export CARRIER_BOUND_REPO_ROOT="$REPO_ROOT"

exec python3 "$SCRIPT_DIR/carrier.py" "$command_name" \
  --repo "$REPO_ROOT" "$@"
