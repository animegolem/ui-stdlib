import { findRawColorsInFile } from "@ui-stdlib/tokens/raw-color-policy.js";
import type { Rule } from "eslint";

import {
  attributeExpression,
  jsxAttributeName,
  type AnyNode,
  type JsxAttributeNode
} from "../ast.js";
import { createContractRule, type BaseRuleOptions } from "../rule.js";

interface NoInlineStylesOptions extends BaseRuleOptions {
  /** Supplied from the component manifest by the registry adapter. */
  readonly allowedProperties?: readonly string[];
}

function staticPropertyName(property: AnyNode): string | null {
  if (property.type !== "Property" || property.computed === true) return null;
  const key = property.key as AnyNode | undefined;
  if (key?.type === "Identifier" && typeof key.name === "string") return key.name;
  if (key?.type === "Literal" && typeof key.value === "string") return key.value;
  return null;
}

export const noInlineStyles = createContractRule<NoInlineStylesOptions>({
  name: "no-inline-styles",
  description: "Disallow JSX style attributes.",
  defaults: {
    contract: "appearance is declared by component classes and --ui- tokens",
    approvedAlternative: "use an admitted class, token, or manifest-declared geometry property",
    definition: { path: "packages/lint/CONTRACTS.md", pointer: "#no-inline-styles" },
    componentManifest: "unavailable; configure the owning item manifest",
    sourceManifest: "unavailable; configure the source item manifest",
    fix: "remove the style attribute or restrict it to manifest-declared geometry properties"
  },
  optionProperties: {
    allowedProperties: {
      type: "array",
      uniqueItems: true,
      items: { type: "string", minLength: 1 }
    }
  },
  create(context, options, report) {
    const allowedProperties = new Set(options.allowedProperties ?? []);
    return {
      JSXAttribute(node: Rule.Node) {
        const attribute = node as unknown as JsxAttributeNode;
        if (jsxAttributeName(attribute) !== "style") return;
        const expression = attributeExpression(attribute);
        if (expression?.type !== "ObjectExpression") {
          report(attribute);
          return;
        }

        const properties = expression.properties as AnyNode[] | undefined;
        const isAdmittedGeometry = properties?.every((property) => {
          const name = staticPropertyName(property);
          if (!name || !allowedProperties.has(name)) return false;
          const value = property.value as AnyNode | undefined;
          if (!value) return false;
          return (
            findRawColorsInFile(
              context.sourceCode.getText(value as unknown as Rule.Node),
              context.getFilename()
            ).length === 0
          );
        });

        if (!isAdmittedGeometry) report(attribute);
      }
    };
  }
});
