# ui-stdlib (working name — owner renames at will)

The house UI standard library: Solid + JSX primitives behind
house-owned façades, one interaction lineage (Ark UI / Zag, pinned
by ceremony), source-owned registry manifests, agent-first lint.
Founded 2026-10-10 at owner direction: "build a really big UI
standard library — decompose systems into our primitives — and
spend tokens doing that."

## The law this repo inherits (pointers, not copies)

- Dependency direction: consumers (expanding-worlds, the harness)
  depend on this library; this library depends on neither.
- One lineage: Ark/Zag behind façades; Kobalte/Corvu/React-Aria
  are oracles and bake-off counterfactuals, never runtime peers.
- Two-layer contract in every manifest: renderer-neutral semantic
  inputs/events (consumer signals own meaning) + a DOM interaction
  adapter (owns ephemeral mechanics). The GPU surface arrives
  later as a second adapter, never as an API emulation.
- Registry: source-owned manifests (upstream project, license,
  version, SHA), deterministic content-addressed build artifacts;
  transports are never trust roots.
- Lint: diagnostics carry the violated contract, the approved
  alternative, and where it is defined. Lint never authorizes; it
  points to review.
- Review tiers: LOAD-BEARING primitives (tree, splitter, focus/
  dismissal, overlay stack) take the full loop — implementation,
  adversarial fanout, lead verdict. LEAF components take desk pass
  + contract tests + lint. The tier is named in each manifest.
- Versions pin by ceremony (digest + parity receipt — tsgo
  precedent). The Ark/Zag/Solid pin lands from the spike report,
  which gates the first component wave; infrastructure waves are
  not gated.
- Decomposition doctrine: adopted systems are decomposed into
  primitives carrying contracts, tests, and provenance — the
  condenser method applied to UI. "Used a lot" earns promotion;
  twice is a coincidence.

Work tracking: RAG/ (house pattern) once the first wave is cut.
Leads: atlas (review), Sol (code) — same channel discipline as
expanding-worlds (.codex/, carrier, verdicts durable before
knocks).

## The base unit (owner, 2026-10-10 — constitutional)

An application IS an accessibility tree and its scene graph; the
app is built over both. The a11y tree is the semantic truth — the
SAME tree serves assistive technology and agents (the machine door;
MCP tools derive from it). The scene graph is the human door.
Nearly every application is therefore an MCP app AND a user app,
dual-headed by construction. **An application without a scene
graph is illegal; an application without an accessibility tree is
equally illegal.** In this library: the manifest's two-layer
contract names these halves — semantic inputs/events ARE the a11y
tree's vocabulary; adapters project it to scenes. A11y contracts
are the primary spec of every primitive, not a checklist.

## License (lean recorded; owner's word at publication gate)

Intended public release. Owner's candidates 2026-10-10: Apache-2.0
leaning (house precedent via Renfield; patent grant; the registry
copy-into-your-app model requires maximal permissiveness — upstream
shadcn/Ark/Zag are all MIT, so inputs permit it). Final license is
the owner's word at the publication gate, as with Renfield.
