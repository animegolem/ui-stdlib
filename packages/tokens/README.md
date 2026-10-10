# @ui-stdlib/tokens

`src/token-source.ts` is the single authored color source. Every token name has
the `--ui-` prefix and every value is an OKLCH string admitted by
`defineTokenSource`. `compileTokenCss` sorts names bytewise and emits
`dist/tokens.css`; that file is generated, never a second source.

The stable `@ui-stdlib/tokens/raw-color-policy.js` export is shared with lint.
It recognizes hex, named, and CSS color-function literals and exempts only the
canonical token source and its generated CSS artifact.
