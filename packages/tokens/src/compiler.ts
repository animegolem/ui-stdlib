import type { TokenSource } from "./types.js";

export function compileTokenCss(source: TokenSource): string {
  const declarations = Object.entries(source.tokens)
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([name, value]) => `  ${name}: ${value};`);

  return [
    "/* Generated from packages/tokens/src/token-source.ts. Do not edit. */",
    ":root {",
    ...declarations,
    "}",
    ""
  ].join("\n");
}
