# ASSIGNMENT — component port waves (QUEUED third: after the spike
# verdict AND the infra wave land; fires the moment rails exist)

Lead: atlas. Assignee: Sol, Sonnet fleets at full fan-out.
Mission (owner, 2026-10-10): port the breadth of the shadcn
catalog — and peers where they're better — onto the house stack.
This library's completeness is the eventual language's adoption
story; "build a real app before lunch" is the bar.

## Round one (census, read-only)

Enumerate the full shadcn catalog (and note Bits/Melt items worth
taking instead where superior). For each component, one row:
house name · interaction source (Ark primitive(s) / pure
composition / none-needed) · review tier (load-bearing vs leaf) ·
wave batch. Batches are symmetric and fence-clean (no shared
files); ~6-10 components per wave. STOP for lead verdict on the
map before wave 1.

## Standing laws for every port

- shadcn is a RECIPE source, not a dependency: no Tailwind, no
  Radix; interaction = Ark façade, appearance = house tokens only
  (lint enforces; zero raw values).
- Every component ships its manifest (provenance: "ported from
  shadcn/ui <version> <component>", license note, two-layer
  declaration, a11y contract, review tier) + contract tests.
- The base unit governs: the a11y tree half is the primary spec;
  a port that reproduces pixels but degrades the semantic tree is
  a defect, not a port.
- Leaf tier review: desk pass + lint + contract tests green.
  Load-bearing tier: full loop with Astra fanout.
- Icons/assets: licenses checked per item; no icon font imports
  without a ruling.
