import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

import {
  admitRegistry,
  RegistryAdmissionError,
  type AdmissionEvidenceResolver,
} from "../src/index.js";
import { evidenceResolver, receipt } from "./evidence.js";

type MutableJson = Record<string, any>;

const leafSource = await readFile(new URL("../fixtures/positive/leaf.json", import.meta.url), "utf8");
const waiverSource = await readFile(
  new URL("../fixtures/positive/load-bearing-waiver.json", import.meta.url),
  "utf8",
);
const passing = { "button.activation": "pass", "tree.selection": "pass" } as const;

function leaf(): MutableJson {
  return JSON.parse(leafSource) as MutableJson;
}

function issuesFor(value: unknown, conformance: Record<string, "pass" | "fail"> = passing): RegistryAdmissionError {
  return issuesForEvidence(value, evidenceResolver(conformance));
}

function issuesForEvidence(value: unknown, evidence: AdmissionEvidenceResolver): RegistryAdmissionError {
  try {
    admitRegistry(JSON.stringify(value), { evidence });
  } catch (error) {
    if (error instanceof RegistryAdmissionError) return error;
    throw error;
  }
  throw new Error("Expected registry admission to fail.");
}

function remove(path: string[]): (fixture: MutableJson) => void {
  return (fixture) => {
    let cursor: MutableJson = fixture;
    for (const segment of path.slice(0, -1)) cursor = cursor[segment] as MutableJson;
    delete cursor[path.at(-1)!];
  };
}

describe("admitRegistry", () => {
  it("admits and freezes the positive leaf fixture with both provenance roles", () => {
    const admitted = admitRegistry(leafSource, { evidence: evidenceResolver(passing) });
    expect(admitted.items[0]!.provenance.map((entry) => entry.role).sort()).toEqual([
      "interaction-source",
      "recipe-source",
    ]);
    expect(Object.isFrozen(admitted)).toBe(true);
    expect(Object.isFrozen(admitted.items[0])).toBe(true);
  });

  it("admits the load-bearing declaration waiver with exact TypeScript error classes", () => {
    const admitted = admitRegistry(waiverSource, { evidence: evidenceResolver(passing) });
    expect(admitted.items[0]!.reviewTier).toBe("load-bearing");
    expect(admitted.items[0]!.declarationHealth).toEqual({
      status: "waived",
      errorClasses: ["TS2693"],
      rulingRef: "SPIKE-UI-KIT-2026-10#declaration-health",
      rationale: "Pinned upstream declarations expose a verified type-only export defect.",
    });
  });

  it("is the only parser and rejects malformed UTF-8/JSON before schema admission", () => {
    expect(() => admitRegistry("{", { evidence: evidenceResolver(passing) })).toThrowError(RegistryAdmissionError);
    expect(issuesFor({}).issues.some((entry) => entry.code === "schema.required")).toBe(true);
  });

  it("admits valid upstream font and base conditional models", () => {
    const font = leaf();
    font.items[0].type = "registry:font";
    font.items[0].font = {
      family: "Inter",
      provider: "google",
      import: "Inter",
      variable: "--font-sans",
    };
    expect(() => admitRegistry(JSON.stringify(font), { evidence: evidenceResolver(passing) })).not.toThrow();

    const base = leaf();
    base.items[0].type = "registry:base";
    Object.assign(base.items[0], {
      style: "house",
      iconLibrary: "lucide",
      baseColor: "neutral",
      theme: "house",
    });
    expect(() => admitRegistry(JSON.stringify(base), { evidence: evidenceResolver(passing) })).not.toThrow();
  });

  it("binds evidence to the normalized admitted manifest, independent of input ordering", () => {
    const hashes: string[] = [];
    const recordingEvidence = (): AdmissionEvidenceResolver => {
      const normal = evidenceResolver(passing);
      return {
        resolveConformance(request) {
          hashes.push(request.manifestSha256);
          return normal.resolveConformance(request);
        },
        resolveDeclarationHealth: normal.resolveDeclarationHealth,
      };
    };
    const reordered = leaf();
    reordered.items[0].files.reverse();
    reordered.items[0].provenance.reverse();
    reordered.items[0].cssTokens.consumes.reverse();

    admitRegistry(leafSource, { evidence: recordingEvidence() });
    admitRegistry(JSON.stringify(reordered), { evidence: recordingEvidence() });
    expect(new Set(hashes).size).toBe(1);
  });

  const structuralFaults: Array<{
    name: string;
    mutate: (fixture: MutableJson) => void;
    code?: string;
  }> = [
    { name: "root schema identity", mutate: remove(["$schema"]) },
    { name: "schemaVersion", mutate: remove(["schemaVersion"]) },
    { name: "registry name", mutate: remove(["name"]) },
    { name: "homepage", mutate: remove(["homepage"]) },
    { name: "items", mutate: remove(["items"]) },
    { name: "one or more items", mutate: (f) => (f.items = []) },
    { name: "include is forbidden", mutate: (f) => (f.include = ["chunk.json"]), code: "schema.not" },
    { name: "manifestVersion", mutate: remove(["items", "0", "manifestVersion"]) },
    { name: "item name", mutate: remove(["items", "0", "name"]) },
    { name: "nonempty item name", mutate: (f) => (f.items[0].name = "") },
    { name: "item type", mutate: remove(["items", "0", "type"]) },
    { name: "files", mutate: remove(["items", "0", "files"]) },
    { name: "one or more files", mutate: (f) => (f.items[0].files = []) },
    { name: "file path", mutate: remove(["items", "0", "files", "0", "path"]) },
    { name: "file type", mutate: remove(["items", "0", "files", "0", "type"]) },
    { name: "file SHA-256", mutate: remove(["items", "0", "files", "0", "sha256"]) },
    { name: "exact file SHA-256", mutate: (f) => (f.items[0].files[0].sha256 = "abc") },
    { name: "registry:file target", mutate: (f) => (f.items[0].files[0].type = "registry:file") },
    { name: "registry:page target", mutate: (f) => (f.items[0].files[0].type = "registry:page") },
    { name: "font item metadata", mutate: (f) => (f.items[0].type = "registry:font") },
    ...["family", "provider", "import", "variable"].map((field) => ({
      name: `font ${field}`,
      mutate: (f: MutableJson) => {
        f.items[0].type = "registry:font";
        f.items[0].font = {
          family: "Inter",
          provider: "google",
          import: "Inter",
          variable: "--font-sans",
        };
        delete f.items[0].font[field];
      },
    })),
    {
      name: "font forbidden outside font items",
      mutate: (f) => (f.items[0].font = { family: "Inter", provider: "google", import: "Inter", variable: "--font-sans" }),
    },
    ...["style", "iconLibrary", "baseColor", "theme"].map((field) => ({
      name: `${field} forbidden outside base items`,
      mutate: (f: MutableJson) => (f.items[0][field] = "fixture"),
    })),
    { name: "provenance", mutate: remove(["items", "0", "provenance"]) },
    { name: "one or more provenance entries", mutate: (f) => (f.items[0].provenance = []) },
    { name: "provenance role", mutate: remove(["items", "0", "provenance", "0", "role"]) },
    { name: "exact provenance role", mutate: (f) => (f.items[0].provenance[0].role = "recipe") },
    { name: "provenance treatment", mutate: remove(["items", "0", "provenance", "0", "treatment"]) },
    { name: "exact provenance treatment", mutate: (f) => (f.items[0].provenance[0].treatment = "vendored") },
    { name: "provenance identity", mutate: remove(["items", "0", "provenance", "0", "identity"]) },
    { name: "identity name", mutate: remove(["items", "0", "provenance", "0", "identity", "name"]) },
    { name: "identity source", mutate: remove(["items", "0", "provenance", "0", "identity", "source"]) },
    {
      name: "immutable HTTPS identity source",
      mutate: (f) => (f.items[0].provenance[0].identity.source = "http://example.invalid/recipe"),
    },
    { name: "identity version", mutate: remove(["items", "0", "provenance", "0", "identity", "version"]) },
    { name: "identity SHA-256", mutate: remove(["items", "0", "provenance", "0", "identity", "sha256"]) },
    { name: "exact identity SHA-256", mutate: (f) => (f.items[0].provenance[0].identity.sha256 = "abc") },
    { name: "license", mutate: remove(["items", "0", "provenance", "0", "license"]) },
    { name: "license SPDX", mutate: remove(["items", "0", "provenance", "0", "license", "spdx"]) },
    { name: "license source", mutate: remove(["items", "0", "provenance", "0", "license", "source"]) },
    { name: "attribution", mutate: remove(["items", "0", "provenance", "0", "attribution"]) },
    { name: "adapted change notes", mutate: remove(["items", "0", "provenance", "0", "changes"]) },
    {
      name: "change notes are conditional",
      mutate: (f) => {
        f.items[0].provenance[0].treatment = "reference";
      },
    },
    { name: "css token contract", mutate: remove(["items", "0", "cssTokens"]) },
    { name: "consumed tokens", mutate: remove(["items", "0", "cssTokens", "consumes"]) },
    { name: "provided tokens", mutate: remove(["items", "0", "cssTokens", "provides"]) },
    { name: "escape contracts", mutate: remove(["items", "0", "cssTokens", "escapes"]) },
    {
      name: "escape scope",
      mutate: (f) => f.items[0].cssTokens.escapes.push({ property: "width", value: "1px", reason: "x", rulingRef: "R#x" }),
    },
    {
      name: "escape property",
      mutate: (f) => f.items[0].cssTokens.escapes.push({ scope: "x", value: "1px", reason: "x", rulingRef: "R#x" }),
    },
    {
      name: "escape value",
      mutate: (f) => f.items[0].cssTokens.escapes.push({ scope: "x", property: "width", reason: "x", rulingRef: "R#x" }),
    },
    {
      name: "escape reason",
      mutate: (f) => f.items[0].cssTokens.escapes.push({ scope: "x", property: "width", value: "1px", rulingRef: "R#x" }),
    },
    {
      name: "escape ruling reference",
      mutate: (f) => f.items[0].cssTokens.escapes.push({ scope: "x", property: "width", value: "1px", reason: "x" }),
    },
    { name: "--ui- token namespace", mutate: (f) => (f.items[0].cssTokens.consumes[0] = "--accent") },
    { name: "a11y contract", mutate: remove(["items", "0", "a11y"]) },
    { name: "a11y requirements", mutate: remove(["items", "0", "a11y", "requirements"]) },
    { name: "one or more a11y requirements", mutate: (f) => (f.items[0].a11y.requirements = []) },
    { name: "a11y requirement id", mutate: remove(["items", "0", "a11y", "requirements", "0", "id"]) },
    {
      name: "a11y requirement statement",
      mutate: remove(["items", "0", "a11y", "requirements", "0", "statement"]),
    },
    { name: "named a11y tests", mutate: remove(["items", "0", "a11y", "tests"]) },
    { name: "one or more named a11y tests", mutate: (f) => (f.items[0].a11y.tests = []) },
    { name: "two-layer boundary", mutate: remove(["items", "0", "boundary"]) },
    { name: "semantic layer", mutate: remove(["items", "0", "boundary", "semantic"]) },
    { name: "DOM adapter", mutate: remove(["items", "0", "boundary", "domAdapter"]) },
    { name: "semantic inputs", mutate: remove(["items", "0", "boundary", "semantic", "inputs"]) },
    { name: "semantic events", mutate: remove(["items", "0", "boundary", "semantic", "events"]) },
    { name: "semantic ownership", mutate: remove(["items", "0", "boundary", "semantic", "owns"]) },
    { name: "DOM ownership", mutate: remove(["items", "0", "boundary", "domAdapter", "owns"]) },
    { name: "nonempty DOM ownership", mutate: (f) => (f.items[0].boundary.domAdapter.owns = []) },
    { name: "review tier", mutate: remove(["items", "0", "reviewTier"]) },
    { name: "review tier enum", mutate: (f) => (f.items[0].reviewTier = "medium") },
    { name: "review declaration", mutate: remove(["items", "0", "reviewDeclaration"]) },
    { name: "declaration health", mutate: remove(["items", "0", "declarationHealth"]) },
    {
      name: "clean health carries no waiver receipt",
      mutate: (f) => (f.items[0].declarationHealth.rulingRef = "RFC#x"),
    },
    {
      name: "waiver exact TS classes",
      mutate: (f) =>
        (f.items[0].declarationHealth = {
          status: "waived",
          errorClasses: ["2693"],
          rulingRef: "RFC#x",
          rationale: "fixture",
        }),
    },
    {
      name: "waiver error classes",
      mutate: (f) =>
        (f.items[0].declarationHealth = { status: "waived", rulingRef: "RFC#x", rationale: "fixture" }),
    },
    {
      name: "waiver ruling reference",
      mutate: (f) =>
        (f.items[0].declarationHealth = { status: "waived", errorClasses: ["TS2693"], rationale: "fixture" }),
    },
    {
      name: "waiver rationale",
      mutate: (f) =>
        (f.items[0].declarationHealth = { status: "waived", errorClasses: ["TS2693"], rulingRef: "RFC#x" }),
    },
  ];

  it.each(structuralFaults)("rejects the one-fault structural fixture: $name", ({ mutate, code }) => {
    const fixture = leaf();
    mutate(fixture);
    const error = issuesFor(fixture);
    expect(error.issues.some((entry) => entry.code === (code ?? "schema.required") || entry.code.startsWith("schema."))).toBe(
      true,
    );
  });

  const semanticFaults: Array<{
    name: string;
    mutate: (fixture: MutableJson) => void;
    code: string;
    conformance?: Record<string, "pass" | "fail">;
  }> = [
    { name: "unknown root field", mutate: (f) => (f.receipt = true), code: "manifest.unknown-field" },
    { name: "review receipt field", mutate: (f) => (f.items[0].reviewReceipt = "yes"), code: "manifest.unknown-field" },
    {
      name: "floating provenance version",
      mutate: (f) => (f.items[0].provenance[0].identity.version = "latest"),
      code: "provenance.floating-version",
    },
    ...["^1.2.3", "~1.2.3", ">=1.0.0", "1.x", "dev"].map((version) => ({
      name: `non-immutable provenance version ${version}`,
      mutate: (f: MutableJson) => (f.items[0].provenance[0].identity.version = version),
      code: "provenance.floating-version",
    })),
    { name: "absolute source path", mutate: (f) => (f.items[0].files[0].path = "/tmp/x"), code: "path.absolute" },
    { name: "drive-absolute source path", mutate: (f) => (f.items[0].files[0].path = "C:/x"), code: "path.absolute" },
    { name: "source traversal", mutate: (f) => (f.items[0].files[0].path = "x/../y"), code: "path.traversal" },
    { name: "source backslash", mutate: (f) => (f.items[0].files[0].path = "x\\y"), code: "path.backslash" },
    { name: "source NUL", mutate: (f) => (f.items[0].files[0].path = "x\0y"), code: "path.nul" },
    {
      name: "source lone surrogate",
      mutate: (f) => (f.items[0].files[0].path = "button/\ud800.ts"),
      code: "path.invalid-unicode",
    },
    {
      name: "source replacement character",
      mutate: (f) => (f.items[0].files[0].path = "button/\ufffd.ts"),
      code: "path.invalid-unicode",
    },
    { name: "Windows-illegal source character", mutate: (f) => (f.items[0].files[0].path = "x:bad.ts"), code: "path.illegal-character" },
    { name: "reserved source segment", mutate: (f) => (f.items[0].files[0].path = "CON.ts"), code: "path.reserved-segment" },
    { name: "trailing source dot", mutate: (f) => (f.items[0].files[0].path = "button/file."), code: "path.trailing-dot-space" },
    {
      name: "non-NFC source path",
      mutate: (f) => (f.items[0].files[0].path = "button/cafe\u0301.ts"),
      code: "path.unicode-normalization",
    },
    {
      name: "case-fold source collision",
      mutate: (f) => (f.items[0].files[1].path = "BUTTON/BUTTON.ts"),
      code: "path.collision",
    },
    {
      name: "Unicode case-fold source collision",
      mutate: (f) => {
        f.items[0].files[0].path = "button/σ.ts";
        f.items[0].files[1].path = "button/ς.ts";
      },
      code: "path.collision",
    },
    {
      name: "Unicode full-fold sharp-s source collision",
      mutate: (f) => {
        f.items[0].files[0].path = "button/ß.ts";
        f.items[0].files[1].path = "button/ẞ.ts";
      },
      code: "path.collision",
    },
    {
      name: "exact duplicate source collision",
      mutate: (f) => (f.items[0].files[1].path = f.items[0].files[0].path),
      code: "path.collision",
    },
    {
      name: "source file-directory prefix collision",
      mutate: (f) => {
        f.items[0].files[0].path = "button";
        f.items[0].files[1].path = "button/button.ts";
      },
      code: "path.prefix-collision",
    },
    {
      name: "Unicode-normalized source collision",
      mutate: (f) => {
        f.items[0].files[0].path = "button/café.ts";
        f.items[0].files[1].path = "button/cafe\u0301.ts";
      },
      code: "path.collision",
    },
    {
      name: "target traversal",
      mutate: (f) => (f.items[0].files[0].target = "@ui/../x.ts"),
      code: "path.traversal",
    },
    {
      name: "absolute target",
      mutate: (f) => (f.items[0].files[0].target = "/ui/x.ts"),
      code: "path.absolute",
    },
    {
      name: "non-NFC target",
      mutate: (f) => (f.items[0].files[0].target = "@ui/cafe\u0301.ts"),
      code: "path.unicode-normalization",
    },
    {
      name: "target replacement character",
      mutate: (f) => (f.items[0].files[0].target = "@ui/\ufffd.ts"),
      code: "path.invalid-unicode",
    },
    {
      name: "target collision",
      mutate: (f) => {
        f.items[0].files[0].target = "@ui/button.ts";
        f.items[0].files[1].target = "@UI/BUTTON.ts";
      },
      code: "target.collision",
    },
    {
      name: "target file-directory prefix collision",
      mutate: (f) => {
        f.items[0].files[0].target = "@ui/button";
        f.items[0].files[1].target = "@ui/button/index.ts";
      },
      code: "target.prefix-collision",
    },
    {
      name: "duplicate a11y requirement",
      mutate: (f) => f.items[0].a11y.requirements.push({ ...f.items[0].a11y.requirements[0] }),
      code: "a11y.duplicate-requirement",
    },
    {
      name: "unresolved named test",
      mutate: (f) => (f.items[0].a11y.tests[0] = "button.missing"),
      code: "a11y.unresolved-test",
    },
    {
      name: "failed named test",
      mutate: () => undefined,
      conformance: { "button.activation": "fail" },
      code: "a11y.failed-test",
    },
    {
      name: "semantic and DOM ownership overlap",
      mutate: (f) => (f.items[0].boundary.domAdapter.owns[0] = "activation state"),
      code: "boundary.overlap",
    },
    {
      name: "DOM mechanics leak into semantic declaration",
      mutate: (f) => f.items[0].boundary.semantic.owns.push("keyboard routing"),
      code: "boundary.dom-leak",
    },
    {
      name: "tier declaration claims a receipt",
      mutate: (f) => (f.items[0].reviewDeclaration = "Approved by the lead."),
      code: "review.declaration-is-receipt",
    },
  ];

  it.each(semanticFaults)("rejects the one-fault semantic fixture: $name", ({ mutate, code, conformance }) => {
    const fixture = leaf();
    mutate(fixture);
    const error = issuesFor(fixture, conformance ?? passing);
    expect(error.issues.map((entry) => entry.code)).toContain(code);
  });

  it("rejects evidence whose receipt binding does not match the admitted manifest", () => {
    const normal = evidenceResolver(passing);
    const evidence: AdmissionEvidenceResolver = {
      ...normal,
      resolveConformance(request) {
        const result = normal.resolveConformance(request);
        return result ? { ...result, manifestSha256: "0".repeat(64) } : undefined;
      },
    };
    expect(issuesForEvidence(leaf(), evidence).issues.map((issue) => issue.code)).toContain(
      "a11y.invalid-evidence",
    );
  });

  it("rejects absent clean-build evidence and mismatched waiver evidence", () => {
    const normal = evidenceResolver(passing);
    const absent: AdmissionEvidenceResolver = {
      ...normal,
      resolveDeclarationHealth: () => undefined,
    };
    expect(issuesForEvidence(leaf(), absent).issues.map((issue) => issue.code)).toContain(
      "declaration-health.unresolved",
    );

    const mismatch: AdmissionEvidenceResolver = {
      ...normal,
      resolveDeclarationHealth(request) {
        const result = normal.resolveDeclarationHealth(request);
        if (!result) return undefined;
        const { receiptBytes: _bytes, receiptSha256: _digest, ...base } = result;
        const body = { ...base, errorClasses: ["TS9999"] };
        return { ...body, ...receipt(body) };
      },
    };
    expect(
      issuesForEvidence(JSON.parse(waiverSource), mismatch).issues.map((issue) => issue.code),
    ).toContain("declaration-health.waiver-mismatch");
  });

  it("rejects a successful compiler result as evidence for a ruled waiver", () => {
    const normal = evidenceResolver(passing);
    const successfulWaiver: AdmissionEvidenceResolver = {
      ...normal,
      resolveDeclarationHealth(request) {
        const result = normal.resolveDeclarationHealth(request);
        if (!result) return undefined;
        const { receiptBytes: _bytes, receiptSha256: _digest, ...base } = result;
        const body = { ...base, exitCode: 0 };
        return { ...body, ...receipt(body) };
      },
    };
    expect(
      issuesForEvidence(JSON.parse(waiverSource), successfulWaiver).issues.map((issue) => issue.code),
    ).toContain("declaration-health.waiver-mismatch");
  });
});
