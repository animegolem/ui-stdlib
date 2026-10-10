export type AnyNode = Record<string, unknown> & {
  readonly type: string;
  readonly parent?: AnyNode;
};

export type JsxAttributeNode = AnyNode & {
  readonly type: "JSXAttribute";
  readonly name: AnyNode & { readonly name?: unknown };
  readonly value?: AnyNode | null;
  readonly parent?: AnyNode;
};

export function jsxAttributeName(node: JsxAttributeNode): string | null {
  return typeof node.name.name === "string" ? node.name.name : null;
}

export function jsxElementName(node: JsxAttributeNode): string | null {
  const opening = node.parent;
  if (opening?.type !== "JSXOpeningElement") return null;
  return renderJsxName(opening.name as AnyNode | undefined);
}

function renderJsxName(node: AnyNode | undefined): string | null {
  if (!node) return null;
  if (node.type === "JSXIdentifier" && typeof node.name === "string") {
    return node.name;
  }
  if (node.type === "JSXMemberExpression") {
    const object = renderJsxName(node.object as AnyNode | undefined);
    const property = renderJsxName(node.property as AnyNode | undefined);
    return object && property ? `${object}.${property}` : null;
  }
  return null;
}

export function staticAttributeString(node: JsxAttributeNode): string | null {
  const value = node.value;
  if (!value) return null;
  if (value.type === "Literal" && typeof value.value === "string") {
    return value.value;
  }
  if (value.type !== "JSXExpressionContainer") return null;
  return staticExpressionString(value.expression as AnyNode | undefined);
}

export function staticExpressionString(node: AnyNode | undefined): string | null {
  if (!node) return null;
  if (node.type === "Literal" && typeof node.value === "string") {
    return node.value;
  }
  if (node.type === "TemplateLiteral") {
    const expressions = node.expressions as unknown[] | undefined;
    const quasis = node.quasis as Array<AnyNode> | undefined;
    if (expressions?.length === 0 && quasis?.length === 1) {
      const value = quasis[0]?.value as { cooked?: unknown } | undefined;
      return typeof value?.cooked === "string" ? value.cooked : null;
    }
  }
  return null;
}

export function attributeExpression(node: JsxAttributeNode): AnyNode | null {
  if (node.value?.type !== "JSXExpressionContainer") return null;
  return (node.value.expression as AnyNode | undefined) ?? null;
}

/** Returns every statically named Solid classList key, or null for a dynamic shape. */
export function staticClassListKeys(node: JsxAttributeNode): readonly string[] | null {
  const expression = attributeExpression(node);
  if (expression?.type !== "ObjectExpression") return null;
  const properties = expression.properties as AnyNode[] | undefined;
  if (!properties) return null;

  const keys: string[] = [];
  for (const property of properties) {
    if (property.type !== "Property") return null;
    const key = property.key as AnyNode | undefined;
    if (property.computed === true) {
      const computed = staticExpressionString(key);
      if (computed === null) return null;
      keys.push(computed);
      continue;
    }
    if (key?.type === "Identifier" && typeof key.name === "string") {
      keys.push(key.name);
      continue;
    }
    if (key?.type === "Literal" && typeof key.value === "string") {
      keys.push(key.value);
      continue;
    }
    return null;
  }
  return keys;
}

export function isNamedVariantCall(
  node: AnyNode | null,
  namedVariants: readonly string[]
): boolean {
  if (node?.type !== "CallExpression") return false;
  const callee = node.callee as AnyNode | undefined;
  return (
    callee?.type === "Identifier" &&
    typeof callee.name === "string" &&
    namedVariants.includes(callee.name)
  );
}
