import { defineTokenSource } from "./types.js";

/** @canonical-token-source The only authored raw-color source in the repository. */
export type OklchValue = `oklch(${string})`;

export const tokenSource = defineTokenSource({
  schemaVersion: 1,
  prefix: "--ui-",
  source: "packages/tokens/src/token-source.ts#canonical-token-source",
  tokens: {
    "--ui-color-accent": "oklch(62% 0.19 264)",
    "--ui-color-canvas": "oklch(98% 0.005 260)",
    "--ui-color-danger": "oklch(58% 0.22 28)",
    "--ui-color-focus": "oklch(68% 0.16 250)",
    "--ui-color-surface": "oklch(94% 0.01 260)",
    "--ui-color-text": "oklch(24% 0.02 260)"
  }
} as const);
