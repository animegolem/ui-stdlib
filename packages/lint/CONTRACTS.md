# Lint contract anchors

These anchors define the lint carrier behavior. Component-specific values come
from the admitted item manifest supplied by the registry adapter; this package
does not parse or reinterpret manifests.

## no-raw-colors

Authored JS/TS strings and CSS declarations cannot carry raw color literals.
They reference admitted `var(--ui-*)` tokens; only the canonical token source
and its generated CSS artifact are exempt.

## no-restyle

Component appearance is owned by the component contract. Consumers select an
admitted named variant instead of attaching replacement classes.

## no-arbitrary-values

Bracket/arbitrary class values are not an admission path. A value must already
exist as an admitted class or `--ui-` token.

## no-inline-styles

JSX `style` attributes bypass component and token contracts and are forbidden
except for continuous-domain or geometry properties explicitly supplied from
the component manifest's per-property escape declarations. Escape keys remain
static and escape values remain subject to the shared raw-color policy.

## no-unknown-classes-tokens

Class and token allowlists are supplied by the registry adapter from the item
manifest. Unknown names require review; lint cannot admit them.

## require-static-classes

Solid `class` and `className` values are static. `classList` values may have
dynamic booleans, but their keys are static. A configured named-variant
function is the only dynamic-key carrier.

## diagnostics

Every diagnostic names the violated contract, approved alternative (or asks
for review), repository-relative definition pointer, component manifest,
source manifest, and precise manual fix. Rules never expose an autofix.
