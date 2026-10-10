#!/usr/bin/env bash
# Read-only validation for the portable two-lead shop.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd -P)"
RAG_DIR="$(cd "$SCRIPT_DIR/.." && pwd -P)"
ROOT_DIR="$(cd "$RAG_DIR/.." && pwd -P)"
ERRORS=0

required=(
  "$ROOT_DIR/AGENTS.md"
  "$ROOT_DIR/CLAUDE.md"
  "$ROOT_DIR/RFC-0001-ui-stdlib-constitution.md"
  "$ROOT_DIR/.codex/PROTOCOL.md"
  "$RAG_DIR/DESIGN-QUEUE.md"
  "$RAG_DIR/HUMAN-TESTING.md"
  "$RAG_DIR/roles/CODE-LEAD.md"
  "$RAG_DIR/roles/REVIEW-LEAD.md"
  "$RAG_DIR/templates/AI-EPIC.md"
  "$RAG_DIR/templates/AI-IMP.md"
  "$RAG_DIR/templates/AI-LOG.md"
  "$RAG_DIR/templates/BRIEF-TEMPLATE.md"
  "$RAG_DIR/templates/VERDICT-TEMPLATE.md"
  "$RAG_DIR/templates/SPEC-TEMPLATE.md"
)

for path in "${required[@]}"; do
  if [[ ! -f "$path" ]]; then
    echo "validate-rag: ERROR missing ${path#"$ROOT_DIR"/}" >&2
    ERRORS=$((ERRORS + 1))
  fi
done

grep -q '<CRITICAL_RULE>' "$RAG_DIR/templates/AI-IMP.md" || {
  echo "validate-rag: ERROR AI-IMP template lost CRITICAL_RULE" >&2
  exit 2
}
grep -q '^### Predictions' "$RAG_DIR/templates/AI-IMP.md" || {
  echo "validate-rag: ERROR AI-IMP template lost Predictions" >&2
  exit 2
}
grep -q '^## Operational Prediction' "$RAG_DIR/templates/AI-EPIC.md" || {
  echo "validate-rag: ERROR AI-EPIC template lost Operational Prediction" >&2
  exit 2
}
grep -q '^date_created:' "$RAG_DIR/templates/AI-LOG.md" || {
  echo "validate-rag: ERROR AI-LOG must use canonical date_created" >&2
  exit 2
}

for pattern in \
  '.workspaces/' \
  '.codex/inbox/' \
  '.codex/outbox/' \
  '.codex/archive/' \
  '.codex/carrier/' \
  '.codex/state/' \
  '.codex/triage-report.md'; do
  grep -qxF "$pattern" "$ROOT_DIR/.gitignore" || {
    echo "validate-rag: ERROR .gitignore missing $pattern" >&2
    exit 2
  }
done

if grep -qxF '.codex/' "$ROOT_DIR/.gitignore"; then
  echo "validate-rag: ERROR .codex/ must not be ignored wholesale" >&2
  exit 2
fi

for script in "$RAG_DIR"/scripts/*.sh; do
  bash -n "$script"
done
python3 -B -c \
  'from pathlib import Path; import sys; [compile(Path(p).read_bytes(), p, "exec") for p in sys.argv[1:]]' \
  "$RAG_DIR/scripts/carrier.py" \
  "$RAG_DIR/scripts/validate-work-ledger.py"

bash "$RAG_DIR/scripts/validate-tickets.sh"
bash "$RAG_DIR/scripts/test-generate-index.sh"
python3 -B "$RAG_DIR/scripts/test-carrier.py"
python3 -B "$RAG_DIR/scripts/test-shop-containment.py"
bash "$RAG_DIR/scripts/test-workspace-create.sh"

if [[ -f "$ROOT_DIR/.codex/WORK-LEDGER.md" ]]; then
  python3 -B "$RAG_DIR/scripts/validate-work-ledger.py" \
    "$ROOT_DIR/.codex/WORK-LEDGER.md"
fi

if [[ $ERRORS -gt 0 ]]; then
  echo "validate-rag: FAIL ($ERRORS structural error(s))" >&2
  exit 2
fi

echo "validate-rag: PASS"
