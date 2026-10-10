import type { Rule } from "eslint";

import {
  jsxAttributeName,
  jsxElementName,
  type JsxAttributeNode
} from "../ast.js";
import { createContractRule, type BaseRuleOptions } from "../rule.js";

interface NoRestyleOptions extends BaseRuleOptions {
  readonly components?: readonly string[];
}

export const noRestyle = createContractRule<NoRestyleOptions>({
  name: "no-restyle",
  description: "Keep component appearance behind admitted variants.",
  defaults: {
    contract: "component appearance is owned by its manifest",
    approvedAlternative: "use an admitted named variant",
    definition: { path: "packages/lint/CONTRACTS.md", pointer: "#no-restyle" },
    componentManifest: "unavailable; configure the owning item manifest",
    sourceManifest: "unavailable; configure the source item manifest",
    fix: "remove class/className and select an admitted variant prop"
  },
  optionProperties: {
    components: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } }
  },
  create(_context, options, report) {
    const components = options.components ?? [];
    return {
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as JsxAttributeNode;
        const name = jsxAttributeName(attribute);
        if (name !== "class" && name !== "className" && name !== "classList") return;
        const component = jsxElementName(attribute);
        if (component && components.includes(component)) report(attribute);
      }
    };
  }
});
