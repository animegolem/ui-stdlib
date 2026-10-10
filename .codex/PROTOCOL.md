# `.codex/` channel protocol — Sol ⇄ Atlas

This file is tracked. The assignment briefs beside it are tracked. Only the
runtime mailbox and materialized state are ignored:

- `.codex/inbox/` — Sol/Code Lead writes; Atlas/Review Lead reads.
- `.codex/outbox/` — Atlas writes; Sol reads.
- `.codex/archive/` — immutable copies of superseded and settled rounds.
- `.codex/carrier/` — immutable payload artifacts and fact receipts.
- `.codex/state/` — disposable SQLite materialized view.
- `.codex/triage-report.md` — changed-only ambient findings.

No watcher, launchd agent, model hook, daemon, or host setting is installed by
this repository. Until separately authorized and fault-tested, both leads
explicitly inspect the mailbox and run the repo-local carrier wrapper. Silence
is not evidence of delivery or authority.

## 1. Truths that must stay separate

Delivery, application ACK, review, verdict, merge, and execution are different
facts. None implies the next.

> Files are the auditable mailbox; the ledger is delivery state; a wake is
> only a hint; the matching application ACK is truth.

The durable file always lands before an ephemeral knock. On the reading side,
the matching carrier event is synced and digest-ACKed before archiving, sending
a response, or reporting that the message was processed. An ACK says only
"these exact bytes were read". It never says accepted, merged, or started.

## 2. Atomic mailbox ritual

Every live message is Markdown with frontmatter containing at least
`submission` and integer `round`. Write it to a temporary sibling and rename it
into place; readers ignore `*.tmp`. Never edit a live file in place.

After writing a live message:

```sh
bash RAG/scripts/ui-channel.sh sync
bash RAG/scripts/ui-channel.sh status
```

After reading a live message, ACK the exact live digest before any other
delivery claim:

```sh
bash RAG/scripts/ui-channel.sh sync
bash RAG/scripts/ui-channel.sh ack-file --file .codex/outbox/<id>.md
```

Atlas uses the same command with `.codex/inbox/<id>.md`. If the live file was
already superseded, ACK the immutable event explicitly with `ack --event-id`.
`status --json` is the authoritative pending-with-age view. The SQLite index is
disposable; `rebuild` reconstructs it from immutable artifacts and receipts.

The carrier's invariant is receipt-first publication: birth receipt → payload
artifact → materialized index. ACK and notification receipts are written before
their index transition. Event identity is deterministic over namespace, topic,
direction, round, and payload digest, so retries rediscover rather than minting
duplicates. A changed payload is a new event and the old payload remains
evidence.

Before relying on the channel in a new environment, run the adoption drill:

1. Overwrite one topic quickly; both payload events survive, and only the read
   digest is ACKed.
2. Exercise an atomic rename and a deliberately torn write; the former yields
   one final event, while any observed partial write remains a visible pending
   monument rather than a lost message.
3. Hold an ACK; `status` retains pending age.
4. Remove only `.codex/state/index.db`, publish a message, then `rebuild`; event
   states and original ages return from artifacts and receipts.

Do not install or remove an external ear as part of this drill. A future ear is
operationally live only after persistent real-target restart, duplicate,
supersession, crash-recovery, and dropout evidence. Transport acceptance is
still not application ACK.

## 3. Work submissions

Sol implements only an authorized brief, in an independent clone and branch
`codex/<id>`, with one commit per ticket and no push. The submission lives at
`.codex/inbox/<id>.md`:

```markdown
---
submission: <kebab-case-id>
type: pre-implementation-review | implementation
branch: codex/<id> | none
commit: <exact tip SHA | base SHA for review-only>
round: 1
submitted: <YYYY-MM-DD>
---

What was verified or built; corrections with file:line citations; exact
validation commands and counts; files touched; candid friction and deviations.
```

The id and branch stay stable across rounds. Atlas answers at
`.codex/outbox/<id>.md`, using `RAG/templates/VERDICT-TEMPLATE.md`. The outbox
round must match the latest inbox round and its `commit` must name the exact tip
reviewed.

Verdict semantics:

- `accepted`: Atlas has independently reproduced the gate and merged the named
  tip to `main`. Sol archives/ACKs and stops; Sol cleans up nothing.
- `amend`: Sol applies only the numbered amendments on the same branch, bumps
  the round, and resubmits.
- `declined`: stop that approach. Notes say whether a different one is invited.
- missing or stale outbox: review is pending. It is never tacit permission.

Round one for non-trivial work is source verification only. Ticket diagnoses
remain hypotheses until checked against current source and ruled by Atlas. An
out-of-cycle `INTERRUPT` or STOP-and-ask freezes the affected surface even if no
response arrives.

## 4. Round archive

Before either writer replaces its live file, preserve the outgoing bytes as:

```text
.codex/archive/<id>-inbox-r<N>.md
.codex/archive/<id>-outbox-r<N>.md
```

At settlement preserve both sides under the same round. ACK the live bytes
before moving them. Never overwrite an archive entry and never delete carrier
artifacts or receipts. The channel is local and ignored, so material that must
survive the machine is promoted deliberately into the tracked RFC, ticket, or
review record; copying chat into canon is not promotion.

## 5. Consultation lane

The same channel carries advisory peer consultation:

```markdown
---
submission: <stable-topic-id>
type: consultation
branch: none
commit: none
round: <N>
---
```

Either lead may challenge assumptions, request source checks, or preserve a
disagreement. There is no fake merge verdict and no implied response SLA.
Consultation cannot authorize implementation or bind design. A conclusion is
normative only when the responsible authority records it in
`RFC-0001-ui-stdlib-constitution.md`, this protocol, a ticket, or an explicit
verdict. Close the topic as `settled` or `parked`, naming surviving
disagreements and the authoritative files actually updated.

## 6. Assignment and execution ledger

An assignment file is an offer, not evidence of execution. When a tracked
`.codex/WORK-LEDGER.md` exists, validate it with
`python3 RAG/scripts/validate-work-ledger.py .codex/WORK-LEDGER.md` and preserve
these states:

```text
offered → received → scheduled → started → done
                         ↘ blocked | parked
```

`received` names the processed digest and resolves in the same turn to
scheduled, blocked, or parked. `scheduled` names executor task id, start, and
scope. `started` names task id, independent clone, branch, base SHA, first
command time, and a renewable progress lease. Every live row has exactly one
`next_actor`. `done` names commits, validation evidence, and verdict round.
A started row may not outlive its executor. Carrier delivery and ACK never
advance this state machine by themselves.

## 7. Independent-clone law and destructive-op fence

The standard container is `.workspaces/<role>/<id>/`, created with:

```sh
bash RAG/scripts/workspace-create.sh <canonical-repo-root> <role>/<id>
```

Entries are independent clones made with `--no-hardlinks`, never Git
worktrees. The creator refuses an existing target and verifies that its Git
common directory is inside the clone.

Canonical destructive-op law:

- Sol never deletes worktrees, clones, branches, tags, or refs, including its
  own after acceptance. Atlas owns cleanup.
- No Sol Git command targets anything outside the sitting's clone. No `-D`,
  force-deletion form, `update-ref`, `reflog expire`, or `gc`.
- Never run `git clean -x` or `git clean -fdx` in the canonical root;
  `.workspaces/` is intentionally ignored and such a sweep can erase every
  independent clone.
- Atlas cleanup resolves and verifies one descendant at a time, never the
  workspace root and never a glob.

## 8. Branch freshness and ticket authority

`main` is canonical. Until an external remote is created at the owner's
publication gate, a fresh independent clone of Atlas's canonical checkout is
the base receipt and origin-freshness checks are waived. Once a remote exists,
the brief must name the fetch/rebase evidence required.

Atlas alone allocates ticket and other reserved identifiers, changes ticket
status, runs `RAG/scripts/generate-index.sh`, and edits `RAG/INDEX.md`. Sol runs
the validator against the ruled base and reports proposed index or human-test
changes; it never edits `RAG/HUMAN-TESTING.md`.

## 9. Build and claim discipline

From a frozen install, the repository gate is ordered and fail-stop:

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm run schema
pnpm run lint
pnpm run lint:parity
pnpm run test
pnpm run rag:validate
```

Build before tests so stale or absent `dist/` cannot masquerade as a product
failure. Read counts and failed lines, not only process exit status. The current
CI makes a Linux claim only: no Electron/GPU/performance result and no cross-OS
digest claim may be inferred from it.

`triage-report.md` changes only for a new actionable finding; identical content
gets no timestamp churn. A STOP remains a stop when delivery machinery is
silent.
