import { describe, expect, it } from "vitest";

import { compileTokenCss } from "../src/compiler.js";
import { tokenSource } from "../src/token-source.js";
import { defineTokenSource } from "../src/types.js";

describe("token compiler", () => {
  it("emits a stable, sorted --ui- custom-property sheet", () => {
    const first = compileTokenCss(tokenSource);
    const second = compileTokenCss(tokenSource);

    expect(first).toBe(second);
    expect(first).toMatchInlineSnapshot(`
      "/* Generated from packages/tokens/src/token-source.ts. Do not edit. */
      :root {
        --ui-color-accent: oklch(62% 0.19 264);
        --ui-color-canvas: oklch(98% 0.005 260);
        --ui-color-danger: oklch(58% 0.22 28);
        --ui-color-focus: oklch(68% 0.16 250);
        --ui-color-surface: oklch(94% 0.01 260);
        --ui-color-text: oklch(24% 0.02 260);
      }
      "
    `);
  });

  it("rejects non-OKLCH values at admission", () => {
    expect(() =>
      defineTokenSource({
        schemaVersion: 1,
        prefix: "--ui-",
        source: "fixture#invalid",
        tokens: { "--ui-bad": "#fff" as `oklch(${string})` }
      })
    ).toThrow("Token value must be an OKLCH string: --ui-bad");
  });
});
