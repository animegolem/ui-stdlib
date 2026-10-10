---
node_id: AI-IMP-*  # sub-tickets: AI-IMP-NNN-N
tags:
  - IMP-LIST
  - Implementation
  - {more-as-needed}
kanban_status: {backlog|planned|in-progress|completed|cancelled|deferred}
depends_on: {optional}
parent_epic: {auto-populated by generate-index.sh}
confidence_score: {0.0-1.0}
date_created: {YYYY-MM-DD}
date_completed: {}
---

# AI-IMP-XXX-{{title-in-snake-case}}

<!-- Professional, concise, complete. {LOC|X} = max lines per heading.
     Remove all comments except the two marked KEEP. -->

## Summary
<!-- Current issue, scope, remediation. ONE measurable done-state. -->
{LOC|15}

### Out of Scope
{LOC|8}

### Design/Approach
<!-- Approach, alternatives rejected, links. -->
{LOC|20}

### Predictions
<!-- KEEP this comment.
Pre-registered BEFORE the checklist starts; one line each; NEVER edited
after — corrections happen in Prediction Review, not here.
P-1..P-4 are REQUIRED; add more (perf numbers, divergence counts,
"this will feel easy/awful") freely — weird, falsifiable, and cheap
beats safe and vague. The point is the error signal, not being right.
FORMAT: `P-N <quantity>: <value or claim> (conf 0.x)`
-->
- P-1 net LOC: {±band}
- P-2 files touched: {n}
- P-3 hardest part will be: {one line, name the WHERE}
- P-4 blast radius: {which existing tests/suites will break, or "none"}
{LOC|12}

### Files to Touch
<!-- Review source BEFORE writing. Paths + 3-word reasons; globs ok. -->
{LOC|20}

### Implementation Checklist
<!-- Atomic, verifiable items: `- [ ] action: file/function/exact change` -->

<CRITICAL_RULE>
Before checking an item, STOP and think: implemented AND validated?
</CRITICAL_RULE>

{LOC|60}

### Acceptance Criteria
<!-- Given-When-Then(-And). These are the law suite: what must hold,
     not how it was built. -->
{LOC|20}

### Prediction Review
<!-- Filled at close, before Issues Encountered.
Quote each P-N: predicted vs actual. Any numeric miss ≥2x, any band
break, or P-3/P-4 wrong in KIND gets a MANDATORY inhibitory line:
  `WRONG BECAUSE: {cause, not excuse — what was different in the
   world than in the prediction}`
Misses are fine. Unexamined misses are defects. -->
{LOC|15}

### Issues Encountered
<!-- KEEP this comment. Filled during/after work. Honest. Failed
     implementations, blockers, missing tests MUST appear here. -->
{LOC|20}
