import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";

import { Ajv } from "ajv";
import draft7MetaSchema from "ajv/dist/refs/json-schema-draft-07.json" with { type: "json" };
import { describe, expect, it } from "vitest";

interface SchemaLock {
  readonly schemas: readonly {
    readonly source: string;
    readonly upstreamSha256: string;
    readonly upstreamPath: string;
    readonly vendoredPath: string;
    readonly vendoredSha256: string;
  }[];
}

function collectRefs(value: unknown, refs: string[] = []): readonly string[] {
  if (Array.isArray(value)) {
    for (const child of value) collectRefs(child, refs);
  } else if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      if (key === "$ref" && typeof child === "string") refs.push(child);
      else collectRefs(child, refs);
    }
  }
  return refs;
}

describe("vendored shadcn schema lock", () => {
  it("pins both source URLs and exact vendored profile bytes without remote refs", async () => {
    const base = new URL("../schemas/vendor/shadcn/", import.meta.url);
    const lock = JSON.parse(await readFile(new URL("schema-lock.json", base), "utf8")) as SchemaLock;
    expect(lock.schemas).toHaveLength(2);

    for (const schema of lock.schemas) {
      expect(schema.source).toMatch(/^https:\/\/ui\.shadcn\.com\/schema\//);
      const upstreamBytes = await readFile(new URL(schema.upstreamPath, base));
      expect(createHash("sha256").update(upstreamBytes).digest("hex")).toBe(schema.upstreamSha256);
      const bytes = await readFile(new URL(schema.vendoredPath, base));
      expect(createHash("sha256").update(bytes).digest("hex")).toBe(schema.vendoredSha256);
      const parsed = JSON.parse(bytes.toString("utf8")) as Record<string, unknown>;
      expect(collectRefs(parsed).some((ref) => /^https?:\/\//u.test(ref))).toBe(false);

      const upstream = JSON.parse(upstreamBytes.toString("utf8")) as Record<string, any>;
      if (schema.vendoredPath.endsWith("registry.schema.json")) {
        upstream.$id = "urn:ui-stdlib:schema:vendor:shadcn:2026-10-10:registry";
        upstream.properties.items.items.$ref = "urn:ui-stdlib:schema:vendor:shadcn:2026-10-10:item";
      } else {
        upstream.$id = "urn:ui-stdlib:schema:vendor:shadcn:2026-10-10:item";
      }
      expect(parsed).toEqual(upstream);
    }
  });

  it("self-validates both vendored and house schemas against draft-07", async () => {
    const ajv = new Ajv({ strict: false, validateSchema: true });
    ajv.addMetaSchema({
      ...draft7MetaSchema,
      $id: "https://json-schema.org/draft-07/schema#",
    });
    const paths = [
      "../schemas/vendor/shadcn/2026-10-10/registry.schema.json",
      "../schemas/vendor/shadcn/2026-10-10/registry-item.schema.json",
      "../schemas/v1/registry.schema.json",
      "../schemas/v1/item.schema.json",
    ];
    for (const path of paths) {
      const schema = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
      expect(ajv.validateSchema(schema), ajv.errorsText(ajv.errors)).toBe(true);
    }
  });
});
