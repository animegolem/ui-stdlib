import type { Rule } from "eslint";

import {
  type AnyNode,
  jsxAttributeName,
  staticClassListKeys,
  staticAttributeString,
  type JsxAttributeNode
} from "../ast.js";
import { createContractRule, type BaseRuleOptions } from "../rule.js";

interface NoUnknownClassesTokensOptions extends BaseRuleOptions {
  readonly knownClasses?: readonly string[];
  readonly knownTokens?: readonly string[];
}

const TOKEN_REFERENCE = /\bvar\(\s*(--ui-[\w-]+)/g;
const VAR_FUNCTION_START = /\bvar\(\s*/g;

type ConstructedStringPart = string | AnyNode;

function containsUiTokenFragment(node: AnyNode): boolean {
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value.includes("--ui-");
  }
  if (node.type === "TemplateElement") {
    const value = node.value as { raw?: unknown } | undefined;
    if (typeof value?.raw === "string" && value.raw.includes("--ui-")) return true;
  }
  for (const [key, value] of Object.entries(node)) {
    if (key === "parent") continue;
    if (Array.isArray(value)) {
      if (value.some((entry) => isNode(entry) && containsUiTokenFragment(entry))) return true;
    } else if (isNode(value) && containsUiTokenFragment(value)) {
      return true;
    }
  }
  return false;
}

function isNode(value: unknown): value is AnyNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function isProvenStringExpression(node: AnyNode | undefined): boolean {
  if (!node) return false;
  if (node.type === "Literal") return typeof node.value === "string";
  if (node.type === "TemplateLiteral") return true;
  if (node.type === "BinaryExpression") {
    return node.operator === "+" && (
      isProvenStringExpression(node.left as AnyNode | undefined) ||
      isProvenStringExpression(node.right as AnyNode | undefined)
    );
  }
  if (node.type === "ConditionalExpression") {
    return (
      isProvenStringExpression(node.consequent as AnyNode | undefined) &&
      isProvenStringExpression(node.alternate as AnyNode | undefined)
    );
  }
  if (node.type === "CallExpression") {
    const callee = node.callee as AnyNode | undefined;
    const property = callee?.type === "MemberExpression" ? callee.property as AnyNode | undefined : undefined;
    return (
      callee?.type === "MemberExpression" &&
      callee.computed !== true &&
      property?.type === "Identifier" &&
      property.name === "concat" &&
      isProvenStringExpression(callee.object as AnyNode | undefined)
    );
  }
  if (
    node.type === "ChainExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TypeCastExpression"
  ) {
    return isProvenStringExpression(node.expression as AnyNode | undefined);
  }
  return false;
}

function isStringConcatCall(node: AnyNode | undefined): boolean {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee as AnyNode | undefined;
  const property = callee?.type === "MemberExpression" ? callee.property as AnyNode | undefined : undefined;
  return (
    callee?.type === "MemberExpression" &&
    callee.computed !== true &&
    property?.type === "Identifier" &&
    property.name === "concat" &&
    isProvenStringExpression(callee.object as AnyNode | undefined)
  );
}

function hasConstructedStringOwner(node: AnyNode): boolean {
  let child = node;
  let parent = child.parent;
  while (
    parent && (
      parent.type === "ChainExpression" ||
      parent.type === "TSAsExpression" ||
      parent.type === "TSNonNullExpression" ||
      parent.type === "TypeCastExpression"
    )
  ) {
    child = parent;
    parent = parent.parent;
  }
  if (parent?.type === "BinaryExpression" && parent.operator === "+") return true;
  if (parent?.type === "TemplateLiteral") return true;
  if (parent?.type === "CallExpression" && isStringConcatCall(parent)) return true;
  return (
    parent?.type === "MemberExpression" &&
    parent.object === child &&
    parent.parent?.type === "CallExpression" &&
    isStringConcatCall(parent.parent)
  );
}

function constructedStringParts(node: AnyNode | undefined): readonly ConstructedStringPart[] | null {
  if (!node) return null;
  if (node.type === "Literal") {
    return typeof node.value === "string" ? [node.value] : [node];
  }
  if (node.type === "Identifier" || node.type === "CallExpression" || node.type === "MemberExpression") {
    if (node.type === "CallExpression") {
      const callee = node.callee as AnyNode | undefined;
      const property = callee?.type === "MemberExpression" ? callee.property as AnyNode | undefined : undefined;
      if (
        callee?.type === "MemberExpression" &&
        callee.computed !== true &&
        property?.type === "Identifier" &&
        property.name === "concat" &&
        isProvenStringExpression(callee.object as AnyNode | undefined)
      ) {
        const object = constructedStringParts(callee.object as AnyNode | undefined);
        const args = node.arguments as AnyNode[] | undefined;
        if (!object || !args) return [node];
        return [
          ...object,
          ...args.flatMap((argument) => constructedStringParts(argument) ?? [argument]),
        ];
      }
    }
    return [node];
  }
  if (node.type === "BinaryExpression") {
    if (node.operator !== "+") return [node];
    const left = constructedStringParts(node.left as AnyNode | undefined);
    const right = constructedStringParts(node.right as AnyNode | undefined);
    return left && right ? [...left, ...right] : null;
  }
  if (node.type === "TemplateLiteral") {
    const quasis = node.quasis as AnyNode[] | undefined;
    const expressions = node.expressions as AnyNode[] | undefined;
    if (!quasis || !expressions || quasis.length !== expressions.length + 1) return null;
    const parts: ConstructedStringPart[] = [];
    for (let index = 0; index < quasis.length; index += 1) {
      const value = quasis[index]?.value as { cooked?: unknown; raw?: unknown } | undefined;
      const text = typeof value?.cooked === "string" ? value.cooked : value?.raw;
      if (typeof text !== "string") return null;
      parts.push(text);
      if (index < expressions.length) {
        const expression = expressions[index];
        if (expression) parts.push(...(constructedStringParts(expression) ?? [expression]));
      }
    }
    return parts;
  }
  if (
    node.type === "ChainExpression" ||
    node.type === "TSAsExpression" ||
    node.type === "TSNonNullExpression" ||
    node.type === "TypeCastExpression"
  ) {
    return constructedStringParts(node.expression as AnyNode | undefined);
  }
  return [node];
}

function constructsDynamicTokenReference(node: AnyNode): boolean {
  const parts = constructedStringParts(node);
  if (!parts?.some((part) => typeof part !== "string")) return false;
  let source = "";
  const dynamicParts: Array<{ readonly index: number; readonly node: AnyNode }> = [];
  for (const part of parts) {
    if (typeof part === "string") {
      source += part;
    } else {
      dynamicParts.push({ index: source.length, node: part });
      source += "\u0000";
    }
  }
  for (const match of source.matchAll(VAR_FUNCTION_START)) {
    const start = match.index;
    const bodyStart = start + match[0].length;
    const end = source.indexOf(")", bodyStart);
    if (end < 0) continue;
    const body = source.slice(bodyStart, end);
    const bodyDynamics = dynamicParts.filter(({ index }) => index >= bodyStart && index < end);
    if (
      bodyDynamics.length > 0 &&
      (body.includes("--ui-") || bodyDynamics.some(({ node: part }) => containsUiTokenFragment(part)))
    ) {
      return true;
    }
  }
  return false;
}

export const noUnknownClassesTokens =
  createContractRule<NoUnknownClassesTokensOptions>({
    name: "no-unknown-classes-tokens",
    description: "Reject classes and --ui- token references absent from admitted manifests.",
    defaults: {
      contract: "classes and tokens are declared by admitted manifests",
      approvedAlternative: null,
      definition: { path: "packages/lint/CONTRACTS.md", pointer: "#no-unknown-classes-tokens" },
      componentManifest: "unavailable; configure the owning item manifest",
      sourceManifest: "unavailable; configure the source item manifest",
      fix: "use a declared class/token or request manifest review for a new one"
    },
    optionProperties: {
      knownClasses: { type: "array", uniqueItems: true, items: { type: "string", minLength: 1 } },
      knownTokens: { type: "array", uniqueItems: true, items: { type: "string", pattern: "^--ui-" } }
    },
    create(_context, options, report) {
      const knownClasses = new Set(options.knownClasses ?? []);
      const knownTokens = new Set(options.knownTokens ?? []);
      const unknownTokenReference = (value: string): string | null => {
        for (const match of value.matchAll(TOKEN_REFERENCE)) {
          const token = match[1];
          if (token && !knownTokens.has(token)) return token;
        }
        return null;
      };
      const inspectTokenReferences = (node: Rule.Node, value: string): void => {
        const token = unknownTokenReference(value);
        if (token) {
          report(node, {
            fix: `replace ${token} with a declared --ui- token or request manifest review`,
          });
        }
      };
      const inspectConstructedTokenReferences = (node: Rule.Node): void => {
        const expression = node as unknown as AnyNode;
        const parts = constructedStringParts(expression);
        if (parts?.every((part) => typeof part === "string")) {
          if (parts.some((part) => unknownTokenReference(part) !== null)) return;
          inspectTokenReferences(node, parts.join(""));
        } else if (constructsDynamicTokenReference(expression)) {
          report(node, {
            fix: "replace the constructed --ui- token with a statically declared token",
          });
        }
      };
      return {
        JSXAttribute(node: Rule.Node) {
          const attribute = node as unknown as JsxAttributeNode;
          const name = jsxAttributeName(attribute);
          if (name === "classList") {
            const unknownKey = staticClassListKeys(attribute)?.find(
              (className) => !knownClasses.has(className),
            );
            if (unknownKey) {
              report(attribute, {
                fix: `replace ${unknownKey} with a declared class or request manifest review`,
              });
            }
            return;
          }
          const value = staticAttributeString(attribute);
          if (value === null) return;

          if (name !== "class" && name !== "className") {
            inspectTokenReferences(attribute as unknown as Rule.Node, value);
            return;
          }

          const unknownClass = value
            .split(/\s+/u)
            .filter(Boolean)
            .find((className) => !knownClasses.has(className));
          if (unknownClass) {
            report(attribute, {
              fix: `replace ${unknownClass} with a declared class or request manifest review`
            });
            return;
          }

          inspectTokenReferences(attribute as unknown as Rule.Node, value);
        },
        Literal(node: Rule.Node) {
          const literal = node as unknown as AnyNode;
          if (typeof literal.value !== "string") return;
          if (
            literal.parent?.type === "JSXAttribute" ||
            (literal.parent?.type === "JSXExpressionContainer" &&
              literal.parent.parent?.type === "JSXAttribute")
          ) {
            return;
          }
          inspectTokenReferences(node, literal.value);
        },
        TemplateElement(node: Rule.Node) {
          const template = node as unknown as AnyNode;
          const value = template.value as { raw?: unknown } | undefined;
          if (typeof value?.raw === "string") inspectTokenReferences(node, value.raw);
        },
        TemplateLiteral(node: Rule.Node) {
          const template = node as unknown as AnyNode;
          if (hasConstructedStringOwner(template)) return;
          inspectConstructedTokenReferences(node);
        },
        BinaryExpression(node: Rule.Node) {
          const binary = node as unknown as AnyNode;
          if (hasConstructedStringOwner(binary)) return;
          inspectConstructedTokenReferences(node);
        },
        CallExpression(node: Rule.Node) {
          const call = node as unknown as AnyNode;
          if (hasConstructedStringOwner(call)) return;
          inspectConstructedTokenReferences(node);
        }
      };
    }
  });
