import type { Rule } from "eslint";

import {
  jsxAttributeName,
  staticClassListKeys,
  staticAttributeString,
  type JsxAttributeNode
} from "../ast.js";
import { createContractRule } from "../rule.js";

const ARBITRARY_VALUE = /(?:^|[\s:-])\[[^\]\r\n]+\]/;

export const noArbitraryValues = createContractRule({
  name: "no-arbitrary-values",
  description: "Disallow arbitrary bracket values in class strings.",
  defaults: {
    contract: "class values come from admitted classes and tokens",
    approvedAlternative: "use a registry-admitted class or var(--ui-*) token",
    definition: { path: "packages/lint/CONTRACTS.md", pointer: "#no-arbitrary-values" },
    componentManifest: "unavailable; configure the owning item manifest",
    sourceManifest: "unavailable; configure the source item manifest",
    fix: "replace the bracket value with an admitted class or token"
  },
  create(_context, _options, report) {
    return {
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as JsxAttributeNode;
        const name = jsxAttributeName(attribute);
        if (name === "classList") {
          const offending = staticClassListKeys(attribute)?.find((key) => ARBITRARY_VALUE.test(key));
          if (offending) report(attribute);
          return;
        }
        if (name === "class" || name === "className") {
          const value = staticAttributeString(attribute);
          if (value && ARBITRARY_VALUE.test(value)) report(attribute);
        }
      }
    };
  }
});
