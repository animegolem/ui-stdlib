# ASSIGNMENT — ui-stdlib infrastructure wave (QUEUED: starts after
# the ui-kit spike report is verdicted; not before)

Lead: atlas. Assignee: Sol, ultracode waves (Sonnet volume).
Scope: the rails before any component — no components in this wave.

1. Registry schema: the manifest format (extends shadcn
   registry.json shape with house fields: upstream provenance,
   CSS-token contract, a11y contract + named conformance tests,
   two-layer boundary declaration, review tier); JSON Schema +
   validator + 3 fixture manifests (valid, each-field-invalid).
2. Token plumbing: CSS custom-property token source format +
   build; zero-raw-color enforcement hook.
3. Lint skeleton: the six rule families from the survey verdict as
   rule stubs with the diagnostic SHAPE implemented (contract,
   alternative, definition pointer) + fixtures proving message
   quality; Oxlint/ESLint carrier per spike findings.
4. Deterministic build: manifest → content-addressed dist artifact;
   byte-reproducibility test.
5. Repo bootstrap: RAG/ tree (house templates), validation
   scripts, CI skeleton (no GPU/perf suites here).

Round-one review first, as always. Fences: no @ark-ui/zag/solid
runtime deps in this wave (the pin isn't ruled yet) — devDeps for
tooling only, exact-pinned.
