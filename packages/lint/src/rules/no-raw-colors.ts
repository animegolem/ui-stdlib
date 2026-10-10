import {
  RAW_COLOR_CONTRACT_DEFINITION,
  findRawColorsInFile
} from "@ui-stdlib/tokens/raw-color-policy.js";
import type { AnyNode } from "../ast.js";
import type { ContractDiagnostic } from "../diagnostics.js";
import { createContractRule } from "../rule.js";

export const RAW_COLOR_DIAGNOSTIC = {
  contract: "colors resolve through the canonical --ui- token source",
  approvedAlternative: "reference an admitted var(--ui-*) token",
  definition: {
    path: RAW_COLOR_CONTRACT_DEFINITION.split("#")[0] ?? "packages/tokens/src/token-source.ts",
    pointer: "#canonical-token-source"
  },
  componentManifest: "unavailable; request component-manifest review",
  sourceManifest: "packages/tokens/src/token-source.ts#canonical-token-source",
  fix: "replace the literal with an admitted var(--ui-*) token"
} satisfies ContractDiagnostic;

export const noRawColors = createContractRule({
  name: "no-raw-colors",
  description: "Disallow authored CSS color literals outside the canonical token source.",
  defaults: RAW_COLOR_DIAGNOSTIC,
  create(context, _options, report) {
    const inspect = (node: AnyNode, value: string): void => {
      const [match] = findRawColorsInFile(value, context.getFilename());
      if (match) {
        report(node, {
          fix: `replace ${match.value} with an admitted var(--ui-*) token`
        });
      }
    };

    return {
      Literal(node) {
        const literal = node as unknown as AnyNode;
        if (typeof literal.value === "string") inspect(literal, literal.value);
      },
      TemplateElement(node) {
        const template = node as unknown as AnyNode;
        const value = template.value as { raw?: unknown } | undefined;
        if (typeof value?.raw === "string") inspect(template, value.raw);
      }
    };
  }
});
