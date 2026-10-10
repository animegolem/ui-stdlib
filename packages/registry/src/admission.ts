import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import { Ajv, type ErrorObject } from "ajv";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with { type: "json" };
import { canonicalize } from "json-canonicalize";

import { RegistryAdmissionError } from "./errors.js";
import type {
  AdmissionIssue,
  AdmissionOptions,
  AdmittedRegistry,
  RegistryItem,
  RegistryManifest,
} from "./types.js";

const ROOT_KEYS = new Set(["$schema", "schemaVersion", "name", "homepage", "items"]);
const ITEM_KEYS = new Set([
  "manifestVersion",
  "name",
  "type",
  "description",
  "title",
  "author",
  "dependencies",
  "devDependencies",
  "registryDependencies",
  "files",
  "tailwind",
  "cssVars",
  "css",
  "envVars",
  "meta",
  "docs",
  "categories",
  "extends",
  "style",
  "iconLibrary",
  "baseColor",
  "theme",
  "font",
  "provenance",
  "cssTokens",
  "a11y",
  "boundary",
  "reviewTier",
  "reviewDeclaration",
  "declarationHealth",
]);
const DOM_MECHANIC = /\b(?:dom|element|focus|pointer|keyboard|tabindex|aria|portal|listener)\b/i;
const IMMUTABLE_VERSION = /^(?:v?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?|[0-9a-f]{7,64})$/;
const RECEIPT_SHA256 = /^[a-f0-9]{64}$/;
const WINDOWS_RESERVED_SEGMENT = /^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;

function loadSchema(relativePath: string): object {
  return JSON.parse(readFileSync(new URL(relativePath, import.meta.url), "utf8")) as object;
}

const vendorItemSchema = loadSchema("../schemas/vendor/shadcn/2026-10-10/registry-item.schema.json");
const vendorRegistrySchema = loadSchema("../schemas/vendor/shadcn/2026-10-10/registry.schema.json");
const houseItemSchema = loadSchema("../schemas/v1/item.schema.json");
const houseRegistrySchema = loadSchema("../schemas/v1/registry.schema.json");

const httpsDraft7MetaSchema = {
  ...draft7MetaSchema,
  $id: "https://json-schema.org/draft-07/schema#",
};
const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: true });
ajv.addMetaSchema(httpsDraft7MetaSchema);
for (const [name, schema] of [
  ["vendor item", vendorItemSchema],
  ["vendor registry", vendorRegistrySchema],
  ["house item", houseItemSchema],
  ["house registry", houseRegistrySchema],
] as const) {
  if (!ajv.validateSchema(schema)) {
    throw new Error(`Invalid ${name} schema: ${ajv.errorsText(ajv.errors)}`);
  }
}
ajv.addSchema(vendorItemSchema);
ajv.addSchema(vendorRegistrySchema);
ajv.addSchema(houseItemSchema);
const validateRegistry = ajv.compile(houseRegistrySchema);

function issue(code: string, path: string, message: string): AdmissionIssue {
  return { code, path, message };
}

function schemaIssue(error: ErrorObject): AdmissionIssue {
  const missing = error.keyword === "required" ? `/${String(error.params.missingProperty)}` : "";
  return issue(`schema.${error.keyword}`, `${error.instancePath || "/"}${missing}`, error.message ?? error.keyword);
}

function jsonPointerSegment(value: string): string {
  return value.replaceAll("~", "~0").replaceAll("/", "~1");
}

function validateUnicodeBeforeNormalization(
  value: unknown,
  path: string,
  issues: AdmissionIssue[],
): void {
  if (typeof value === "string") {
    const portablePath = path.endsWith("/path") || path.endsWith("/target");
    if (/[\uD800-\uDFFF]/u.test(value)) {
      issues.push(issue(
        portablePath ? "path.invalid-unicode" : "unicode.invalid-scalar",
        path || "/",
        "Manifest strings must contain only well-formed Unicode scalar values.",
      ));
    } else if (portablePath && value.includes("\uFFFD")) {
      issues.push(issue(
        "path.invalid-unicode",
        path,
        "Portable paths cannot contain U+FFFD, which may alias a prior encoding failure.",
      ));
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => validateUnicodeBeforeNormalization(entry, `${path}/${index}`, issues));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      validateUnicodeBeforeNormalization(entry, `${path}/${jsonPointerSegment(key)}`, issues);
    }
  }
}

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function collisionKey(value: string): string {
  // Conservative NFKC caseless key for portable filesystems. Upper-then-lower
  // captures multi-codepoint mappings and final sigma; sharp-s needs an
  // explicit expansion because ECMAScript preserves capital sharp-s.
  return value
    .normalize("NFKC")
    .replace(/[ßẞ]/gu, "ss")
    .toUpperCase()
    .toLowerCase()
    .normalize("NFKC");
}

function validatePortablePath(value: string, path: string, issues: AdmissionIssue[]): void {
  if (value.includes("\0")) {
    issues.push(issue("path.nul", path, "Portable paths cannot contain NUL."));
  }
  if (value.includes("\\")) {
    issues.push(issue("path.backslash", path, "Portable paths must use forward slashes."));
  }
  if (value !== value.normalize("NFC")) {
    issues.push(issue("path.unicode-normalization", path, "Portable paths must already be NFC-normalized."));
  }
  if (/^(?:\/|[A-Za-z]:\/|\/\/)/.test(value)) {
    issues.push(issue("path.absolute", path, "Portable paths must be relative."));
  }
  const segments = value.split("/");
  for (const segment of segments) {
    if (/[\u0000-\u001f<>:"|?*]/u.test(segment)) {
      issues.push(issue("path.illegal-character", path, "Portable path segments cannot contain control or Windows-illegal characters."));
    }
    if (/[. ]$/u.test(segment)) {
      issues.push(issue("path.trailing-dot-space", path, "Portable path segments cannot end in a dot or space."));
    }
    if (WINDOWS_RESERVED_SEGMENT.test(segment)) {
      issues.push(issue("path.reserved-segment", path, `Portable path segment ${segment} is reserved on Windows.`));
    }
  }
  if (segments.some((segment) => segment === ".." || segment === ".")) {
    issues.push(issue("path.traversal", path, "Portable paths cannot contain dot segments."));
  }
  if (value.length === 0 || segments.some((segment) => segment.length === 0)) {
    issues.push(issue("path.empty-segment", path, "Portable paths cannot be empty or contain empty segments."));
  }
}

function registerPortablePath(
  value: string,
  path: string,
  namespace: "path" | "target",
  entries: Map<string, string>,
  issues: AdmissionIssue[],
): void {
  const key = collisionKey(value);
  for (const [existing, previous] of entries) {
    if (key === existing) {
      issues.push(issue(
        `${namespace}.collision`,
        path,
        `Portable ${namespace} collides by duplicate, case-folding, or Unicode normalization with ${previous}.`,
      ));
      return;
    }
    if (key.startsWith(`${existing}/`) || existing.startsWith(`${key}/`)) {
      issues.push(issue(
        `${namespace}.prefix-collision`,
        path,
        `Portable ${namespace} has a file/directory prefix collision with ${previous}.`,
      ));
      return;
    }
  }
  entries.set(key, path);
}

function sameStrings(left: readonly string[], right: readonly string[]): boolean {
  return [...left].sort(compareText).join("\0") === [...right].sort(compareText).join("\0");
}

function receiptBody(bytes: Uint8Array, claimedSha256: string): Record<string, unknown> | null {
  if (!(bytes instanceof Uint8Array)) return null;
  if (createHash("sha256").update(bytes).digest("hex") !== claimedSha256) return null;
  try {
    const parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    return parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function receiptStrings(value: unknown): readonly string[] | null {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
    ? value
    : null;
}

function validateUnknownKeys(
  value: Record<string, unknown>,
  allowed: ReadonlySet<string>,
  path: string,
  issues: AdmissionIssue[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      issues.push(issue("manifest.unknown-field", `${path}/${key}`, "This field is outside the admitted profile."));
    }
  }
}

function validateItem(
  item: RegistryItem,
  itemIndex: number,
  options: AdmissionOptions,
  pathCollisions: Map<string, string>,
  targetCollisions: Map<string, string>,
  manifestSha256: string,
  issues: AdmissionIssue[],
): void {
  const base = `/items/${itemIndex}`;
  validateUnknownKeys(item as Record<string, unknown>, ITEM_KEYS, base, issues);

  for (const [provenanceIndex, provenance] of item.provenance.entries()) {
    if (!IMMUTABLE_VERSION.test(provenance.identity.version)) {
      issues.push(
        issue(
          "provenance.floating-version",
          `${base}/provenance/${provenanceIndex}/identity/version`,
          "Provenance identity must pin an immutable version or revision.",
        ),
      );
    }
  }

  for (const [fileIndex, file] of item.files.entries()) {
    const filePath = `${base}/files/${fileIndex}/path`;
    validatePortablePath(file.path, filePath, issues);
    registerPortablePath(file.path, filePath, "path", pathCollisions, issues);
    if (file.target !== undefined) {
      const targetPath = `${base}/files/${fileIndex}/target`;
      validatePortablePath(file.target, targetPath, issues);
      registerPortablePath(file.target, targetPath, "target", targetCollisions, issues);
    }
  }

  const requirementIds = new Set<string>();
  for (const [requirementIndex, requirement] of item.a11y.requirements.entries()) {
    if (requirementIds.has(requirement.id)) {
      issues.push(
        issue(
          "a11y.duplicate-requirement",
          `${base}/a11y/requirements/${requirementIndex}/id`,
          `Accessibility requirement ${requirement.id} is declared more than once.`,
        ),
      );
    }
    requirementIds.add(requirement.id);
  }

  const testNames = new Set<string>();
  for (const [testIndex, testName] of item.a11y.tests.entries()) {
    const testPath = `${base}/a11y/tests/${testIndex}`;
    if (testNames.has(testName)) {
      issues.push(issue("a11y.duplicate-test", testPath, `Conformance test ${testName} is declared more than once.`));
    }
    testNames.add(testName);
    const evidence = options.evidence.resolveConformance({
      manifestSha256,
      itemName: item.name,
      testName,
    });
    const receipt = evidence
      ? receiptBody(evidence.receiptBytes, evidence.receiptSha256)
      : null;
    if (!evidence) {
      issues.push(issue("a11y.unresolved-test", testPath, `Conformance test ${testName} did not resolve.`));
    } else if (
      evidence.kind !== "a11y-conformance" ||
      evidence.manifestSha256 !== manifestSha256 ||
      evidence.itemName !== item.name ||
      evidence.testName !== testName ||
      evidence.runner.length === 0 ||
      evidence.invocation.length === 0 ||
      !RECEIPT_SHA256.test(evidence.receiptSha256) ||
      receipt?.kind !== evidence.kind ||
      receipt.manifestSha256 !== manifestSha256 ||
      receipt.itemName !== item.name ||
      receipt.testName !== testName ||
      receipt.status !== evidence.status ||
      receipt.runner !== evidence.runner ||
      receipt.invocation !== evidence.invocation
    ) {
      issues.push(issue("a11y.invalid-evidence", testPath, `Conformance evidence for ${testName} is not bound to this manifest and item.`));
    } else if (evidence.status !== "pass") {
      issues.push(issue("a11y.failed-test", testPath, `Conformance test ${testName} did not pass.`));
    }
  }

  const healthPath = `${base}/declarationHealth`;
  const healthEvidence = options.evidence.resolveDeclarationHealth({
    manifestSha256,
    itemName: item.name,
    declaration: item.declarationHealth,
  });
  const healthReceipt = healthEvidence
    ? receiptBody(healthEvidence.receiptBytes, healthEvidence.receiptSha256)
    : null;
  if (!healthEvidence) {
    issues.push(issue("declaration-health.unresolved", healthPath, "Declaration health requires an external compiler or waiver receipt."));
  } else if (
    healthEvidence.kind !== "declaration-health" ||
    healthEvidence.manifestSha256 !== manifestSha256 ||
    healthEvidence.itemName !== item.name ||
    healthEvidence.skipLibCheck !== false ||
    !RECEIPT_SHA256.test(healthEvidence.receiptSha256) ||
    healthReceipt?.kind !== healthEvidence.kind ||
    healthReceipt.manifestSha256 !== manifestSha256 ||
    healthReceipt.itemName !== item.name ||
    healthReceipt.status !== healthEvidence.status ||
    healthReceipt.skipLibCheck !== false ||
    healthReceipt.exitCode !== healthEvidence.exitCode
  ) {
    issues.push(issue("declaration-health.invalid-evidence", healthPath, "Declaration-health evidence is not bound to this manifest and item."));
  } else if (item.declarationHealth.status === "clean") {
    if (healthEvidence.status !== "clean" || healthEvidence.exitCode !== 0) {
      issues.push(issue("declaration-health.not-clean", healthPath, "Clean declaration health requires a successful skipLibCheck:false compiler receipt."));
    }
  } else if (
    healthEvidence.status !== "waived" ||
    healthEvidence.exitCode === 0 ||
    healthEvidence.rulingRef !== item.declarationHealth.rulingRef ||
    !sameStrings(healthEvidence.errorClasses ?? [], item.declarationHealth.errorClasses) ||
    healthReceipt.rulingRef !== healthEvidence.rulingRef ||
    !sameStrings(receiptStrings(healthReceipt.errorClasses) ?? [], item.declarationHealth.errorClasses)
  ) {
    issues.push(issue("declaration-health.waiver-mismatch", healthPath, "Waiver evidence must match the ruled reference and exact TypeScript error classes."));
  }

  const semanticOwnership = new Set(item.boundary.semantic.owns.map(collisionKey));
  for (const [ownershipIndex, ownership] of item.boundary.domAdapter.owns.entries()) {
    if (semanticOwnership.has(collisionKey(ownership))) {
      issues.push(
        issue(
          "boundary.overlap",
          `${base}/boundary/domAdapter/owns/${ownershipIndex}`,
          "Semantic and DOM adapter ownership must be disjoint.",
        ),
      );
    }
  }
  for (const [field, values] of Object.entries(item.boundary.semantic)) {
    for (const [valueIndex, value] of values.entries()) {
      if (DOM_MECHANIC.test(value)) {
        issues.push(
          issue(
            "boundary.dom-leak",
            `${base}/boundary/semantic/${field}/${valueIndex}`,
            "Renderer-neutral semantic declarations cannot own DOM interaction mechanics.",
          ),
        );
      }
    }
  }

  if (/\b(?:accepted|approved|receipt|signed[ -]?off|reviewed by)\b/i.test(item.reviewDeclaration)) {
    issues.push(
      issue(
        "review.declaration-is-receipt",
        `${base}/reviewDeclaration`,
        "A review-tier declaration states required review; it cannot claim review receipt.",
      ),
    );
  }
}

function sortStrings(values: string[]): void {
  values.sort(compareText);
}

function normalizeManifest(manifest: RegistryManifest): RegistryManifest {
  const normalized = structuredClone(manifest) as RegistryManifest;
  const items = normalized.items as RegistryItem[];
  items.sort((left, right) => compareText(left.name, right.name));
  for (const item of items) {
    (item.files as unknown as Array<{ path: string }>).sort((left, right) =>
      compareText(left.path, right.path),
    );
    (item.provenance as unknown as Array<Record<string, unknown>>).sort((left, right) =>
      compareText(canonicalize(left), canonicalize(right)),
    );
    for (const key of ["dependencies", "devDependencies", "registryDependencies", "categories"] as const) {
      const values = item[key];
      if (Array.isArray(values)) sortStrings(values as string[]);
    }
    sortStrings(item.cssTokens.consumes as string[]);
    sortStrings(item.cssTokens.provides as string[]);
    (item.cssTokens.escapes as unknown as Array<Record<string, unknown>>).sort((left, right) =>
      compareText(canonicalize(left), canonicalize(right)),
    );
    (item.a11y.requirements as unknown as Array<{ id: string }>).sort((left, right) =>
      compareText(left.id, right.id),
    );
    sortStrings(item.a11y.tests as string[]);
    sortStrings(item.boundary.semantic.inputs as string[]);
    sortStrings(item.boundary.semantic.events as string[]);
    sortStrings(item.boundary.semantic.owns as string[]);
    sortStrings(item.boundary.domAdapter.owns as string[]);
    if (item.declarationHealth.status === "waived") {
      sortStrings(item.declarationHealth.errorClasses as string[]);
    }
    for (const provenance of item.provenance) {
      if (provenance.changes !== undefined) sortStrings(provenance.changes as string[]);
    }
  }
  return normalized;
}

function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}

/** The only parser and semantic admission boundary for registry manifests. */
export function admitRegistry(source: string | Uint8Array, options: AdmissionOptions): AdmittedRegistry {
  let candidate: unknown;
  try {
    candidate = JSON.parse(typeof source === "string" ? source : new TextDecoder("utf-8", { fatal: true }).decode(source));
  } catch (error) {
    throw new RegistryAdmissionError([
      issue("json.invalid", "/", error instanceof Error ? error.message : "Input is not valid UTF-8 JSON."),
    ]);
  }

  const unicodeIssues: AdmissionIssue[] = [];
  validateUnicodeBeforeNormalization(candidate, "", unicodeIssues);
  if (unicodeIssues.length > 0) {
    unicodeIssues.sort((left, right) => compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`));
    throw new RegistryAdmissionError(unicodeIssues);
  }

  if (!validateRegistry(candidate)) {
    throw new RegistryAdmissionError((validateRegistry.errors ?? []).map(schemaIssue));
  }

  const manifest = candidate as RegistryManifest;
  const normalizedManifest = normalizeManifest(manifest);
  const manifestSha256 = createHash("sha256").update(canonicalize(normalizedManifest)).digest("hex");
  const issues: AdmissionIssue[] = [];
  validateUnknownKeys(manifest as unknown as Record<string, unknown>, ROOT_KEYS, "", issues);

  const itemNames = new Map<string, string>();
  const pathCollisions = new Map<string, string>();
  const targetCollisions = new Map<string, string>();
  for (const [itemIndex, item] of manifest.items.entries()) {
    const nameKey = collisionKey(item.name);
    const previous = itemNames.get(nameKey);
    if (previous !== undefined) {
      issues.push(
        issue(
          "item.name-collision",
          `/items/${itemIndex}/name`,
          `Item name collides by case-folding or Unicode normalization with ${previous}.`,
        ),
      );
    } else {
      itemNames.set(nameKey, `/items/${itemIndex}/name`);
    }
    validateItem(item, itemIndex, options, pathCollisions, targetCollisions, manifestSha256, issues);
  }

  if (issues.length > 0) {
    issues.sort((left, right) => compareText(`${left.path}\0${left.code}`, `${right.path}\0${right.code}`));
    throw new RegistryAdmissionError(issues);
  }

  return deepFreeze(normalizedManifest) as AdmittedRegistry;
}
