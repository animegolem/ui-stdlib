import type { Rule } from "eslint";

import {
  attributeExpression,
  isNamedVariantCall,
  jsxAttributeName,
  staticClassListKeys,
  staticAttributeString,
  type JsxAttributeNode
} from "../ast.js";
import { createContractRule, type BaseRuleOptions } from "../rule.js";

interface RequireStaticClassesOptions extends BaseRuleOptions {
  readonly namedVariants?: readonly string[];
}

export const requireStaticClasses = createContractRule<RequireStaticClassesOptions>({
  name: "require-static-classes",
  description: "Require statically resolvable Solid class keys or configured named variants.",
  defaults: {
    contract: "Solid class keys are statically resolvable",
    approvedAlternative: "use a static class/classList key or a configured named variant",
    definition: { path: "packages/lint/CONTRACTS.md", pointer: "#require-static-classes" },
    componentManifest: "unavailable; configure the owning item manifest",
    sourceManifest: "unavailable; configure the source item manifest",
    fix: "replace the dynamic class key with a static key or call a configured named variant"
  },
  optionProperties: {
    namedVariants: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } }
  },
  create(_context, options, report) {
    const namedVariants = options.namedVariants ?? [];
    return {
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as JsxAttributeNode;
        const name = jsxAttributeName(attribute);
        if (name !== "class" && name !== "className" && name !== "classList") return;

        if (name !== "classList" && staticAttributeString(attribute) !== null) return;
        const expression = attributeExpression(attribute);
        if (isNamedVariantCall(expression, namedVariants)) return;
        if (name === "classList" && staticClassListKeys(attribute) !== null) return;
        report(attribute);
      }
    };
  }
});
