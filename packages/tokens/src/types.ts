import type { OklchValue } from "./token-source.js";

export const TOKEN_PREFIX = "--ui-" as const;

export type UiTokenName = `${typeof TOKEN_PREFIX}${string}`;
export type { OklchValue } from "./token-source.js";

export interface TokenSource {
  readonly schemaVersion: 1;
  readonly prefix: typeof TOKEN_PREFIX;
  readonly source: string;
  readonly tokens: Readonly<Record<UiTokenName, OklchValue>>;
}

const OKLCH_VALUE =
  /^oklch\(\s*(?:\d+(?:\.\d+)?%|0(?:\.\d+)?|1(?:\.0+)?)\s+(?:0(?:\.\d+)?|\.\d+|\d+(?:\.\d+)?)\s+(?:0|\d+(?:\.\d+)?)(?:deg)?(?:\s*\/\s*(?:\d+(?:\.\d+)?%|0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/i;

export function defineTokenSource<const T extends TokenSource>(source: T): T {
  if (source.schemaVersion !== 1) {
    throw new Error(`Unsupported token source schema: ${String(source.schemaVersion)}`);
  }

  if (source.prefix !== TOKEN_PREFIX) {
    throw new Error(`Token prefix must be ${TOKEN_PREFIX}`);
  }

  for (const [name, value] of Object.entries(source.tokens)) {
    if (!name.startsWith(TOKEN_PREFIX)) {
      throw new Error(`Token name must start with ${TOKEN_PREFIX}: ${name}`);
    }

    if (!OKLCH_VALUE.test(value)) {
      throw new Error(`Token value must be an OKLCH string: ${name}`);
    }
  }

  Object.freeze(source.tokens);
  return Object.freeze(source);
}
