import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

describe("Oxlint secondary parity declaration", () => {
  it("pins the tool and records its intentionally narrower authority", async () => {
    const declaration = JSON.parse(
      await readFile(
        new URL("../fixtures/oxlint-parity.expected.json", import.meta.url),
        "utf8"
      )
    ) as Record<string, unknown>;

    expect(declaration).toMatchObject({
      schemaVersion: 1,
      tool: { name: "oxlint", version: "1.24.0" },
      authority: "secondary",
      scope: "parser-and-corpus-health-only",
      customRuleExecution: false,
      expected: { corpusFiles: 6, exitCode: 0, parserDiagnostics: 0 },
      receipt: "dist/oxlint-parity-receipt.json"
    });
    expect(declaration.limitation).toContain("ESLint v9 fixtures are the semantic authority");
  });
});
