# @ui-stdlib/lint

ESLint v9 is the semantic authority for exactly six rule families exported by
this package. Registry integration supplies component/source manifest pointers,
known classes and tokens, named variants, and allowed continuous-domain or
geometry properties through rule options. The lint package never parses a
manifest and never authorizes a new escape.

`pnpm parity:oxlint` exact-checks Oxlint 1.24.0, parser-checks the shared TSX
corpus, and writes `dist/oxlint-parity-receipt.json`. This is deliberately a
secondary parser/corpus-health receipt: the pinned Oxlint release cannot
stably execute these custom JavaScript rules. The ESLint/Vitest fixtures are
the diagnostic and behavior authority.

The root lint gate loads this built plugin for source files and runs the shared
CSS scanner as a second carrier, so Solid `classList`, template-built token
names, and stylesheet color declarations cannot bypass the six families.

All diagnostics include the violated contract, approved alternative or review
request, repository-relative definition pointer, component manifest, source
manifest, and precise manual fix. No rule advertises an autofix or suggestion.
