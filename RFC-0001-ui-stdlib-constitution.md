# RFC-0001 — ui-stdlib constitution

| REVISION | DATE | CHANGE |
|---|---|---|
| r1 | 2026-10-10 | Founded: README law promoted per infra-wave r1 ruling 6 |

This document is the repo's normative law. The README is its porch
summary; where they diverge, this RFC wins. Amendments bump the
revision row and name their ruling.

## 1. Purpose and dependency direction

The house UI standard library: Solid + JSX primitives behind
house-owned façades. Consumers (expanding-worlds, the harness, any
future app) depend on this library; this library depends on no
consumer. License: Apache-2.0 (owner ruling 2026-10-10, estate
policy for language-shaped artifacts).

## 2. The base unit (constitutional; owner, 2026-10-10)

An application IS an accessibility tree and its scene graph; the
application is built over both. The a11y tree is semantic truth —
one tree serves assistive technology and agents alike (the machine
door; MCP surfaces derive from it). The scene graph is the human
door. An application without a scene graph is illegal; an
application without an accessibility tree is equally illegal. In
this library: every primitive's manifest declares the two-layer
contract — renderer-neutral semantic inputs/events (the a11y
tree's vocabulary; consumer signals own meaning) and a DOM
interaction adapter (ephemeral mechanics). A11y contracts are each
primitive's primary spec.

## 3. The one-lineage law

Ark UI / Zag is the single interaction lineage, behind house
façades, pinned by ceremony (digest + parity receipt). Kobalte,
Corvu, and React Aria are oracles and bake-off counterfactuals,
never runtime peers. A second focus/dismissal/portal stack
requires a recorded defect case, never convenience. Current pin
status: NO-GO at Solid 1.9.17 / Ark 5.39.3 / Zag 1.45.0
(SPIKE-UI-KIT-2026-10, EW audits); re-spike fires on a candidate.

## 4. Admission law (infra-wave r1 rulings, 2026-10-10)

- Two schemas (versioned house root + item), vendored upstream
  profiles, no remote $ref: transport never mutates admission law.
- ONE admission API; the registry build consumes it — a second
  parser is forbidden.
- Declaration health is admission: skipLibCheck:false clean or a
  ruled waiver naming exact error classes.
- Typed provenance roles (recipe-source, interaction-source), with
  upstream project, license, version, SHA.
- Named a11y conformance tests must resolve and pass at admission;
  a review tier declared is not a receipt. Tiers: LOAD-BEARING
  (full loop with adversarial fanout) and LEAF (desk pass +
  contract tests + lint); the tier is named in the manifest.
- Fixture law: positive models plus table-driven one-fault
  negatives for every required and conditional rule.

## 5. Tokens and lint

One canonical token source compiled to CSS custom properties;
colors are OKLCH strings; namespace `--ui-`; raw color literals
are unsayable outside the token source. Lint: six rule families
(no-raw-colors, no-restyle, no-arbitrary-values, no-inline-styles,
no-unknown-classes/tokens, require-static-classes); diagnostics
carry the violated contract, the approved alternative, and where
it is defined; lint never authorizes — it points to review.
Carrier: ESLint-v9-compatible authority with exact-pinned Oxlint
parity secondary; parity divergences are ledger rows. Solid
classList keys are statically resolvable; dynamic styling passes
through named variants. Escape contracts live in item manifests.

## 6. Reproducibility

Canonical-JSON envelope over the admitted manifest plus ordered
(path, bytes); versioned SHA-256 preimage; portable path law;
atomic writes; no clock, cwd, or locale anywhere in the build.
Claim scope equals CI evidence: same-host now; cross-OS only when
those legs run.

## 7. Work tracking and review

The portable shop (constitution, charters, templates, validators,
protocol, carrier) governs; EW's current prediction-bearing
templates are the base, reconciled with the newest validator —
reconciliations documented here, never silent. Leads: atlas
(review: rulings, verdicts, merges, INDEX) and Sol (code:
implementation sittings, round-one reviews first, durable channel
discipline — verdict files before knocks, digest-ACK closure).
Branch: main. No remote until the owner's publication gate;
origin-freshness checks waived until one exists.

## 8. Number reservations (lead, 2026-10-10)

Reserved at cut time per house law: AI-EPIC-001 (the
infrastructure epic — rails before components); AI-IMP-001
registry schemas + admission API; AI-IMP-002 tokens; AI-IMP-003
lint skeletons; AI-IMP-004 deterministic build; AI-IMP-005 shop
bootstrap + CI. Full ticket texts are cut by the lead after the
shop's templates land in the infra-wave commit; these numbers are
law now — no parallel work takes them.
