import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, readdir, symlink, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import {
  buildRegistryArtifact,
  HASH_ALGORITHM,
  HASH_DOMAIN,
} from "../src/index.js";
import { evidenceResolver } from "./evidence.js";

type MutableJson = Record<string, any>;

const leafSource = await readFile(new URL("../fixtures/positive/leaf.json", import.meta.url), "utf8");
const fixtureSources = new URL("../fixtures/sources/", import.meta.url);
const conformance = { "button.activation": "pass" } as const;
const temporaryRoots: string[] = [];

async function temporaryRoot(prefix: string): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), prefix));
  temporaryRoots.push(root);
  return root;
}

async function populatedRoot(prefix: string): Promise<string> {
  const root = await temporaryRoot(prefix);
  await cp(fixtureSources, root, { recursive: true });
  return root;
}

async function buildFixture(prefix: string): Promise<{ repository: string; source: string; output: string }> {
  const repository = await temporaryRoot(prefix);
  const source = join(repository, "source");
  const output = join(repository, "output");
  await cp(fixtureSources, source, { recursive: true });
  await mkdir(output);
  return { repository, source, output };
}

function reorderedManifest(reverse: boolean): string {
  const manifest = JSON.parse(leafSource) as MutableJson;
  const item = manifest.items[0];
  item.provenance.push({
    ...structuredClone(item.provenance[0]),
    identity: {
      ...structuredClone(item.provenance[0].identity),
      source: "https://example.invalid/recipe-second",
      version: "1.2.4",
      sha256: "4444444444444444444444444444444444444444444444444444444444444444",
    },
    attribution: "Second fixture recipe author",
    changes: ["Changed the same recipe in a second distinct way"],
  });
  item.cssTokens.escapes.push(
    {
      scope: "button outline",
      property: "outline-offset",
      value: "1px",
      reason: "First tied escape reason",
      rulingRef: "RFC-0001#escape-a",
    },
    {
      scope: "button outline",
      property: "outline-offset",
      value: "1px",
      reason: "Second tied escape reason",
      rulingRef: "RFC-0001#escape-b",
    },
  );
  if (reverse) {
    item.files.reverse();
    item.provenance.reverse();
    item.cssTokens.consumes.reverse();
    item.cssTokens.escapes.reverse();
    item.boundary.semantic.inputs.reverse();
    item.boundary.domAdapter.owns.reverse();
  }
  return JSON.stringify(manifest);
}

afterEach(async () => {
  const { rm } = await import("node:fs/promises");
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("buildRegistryArtifact", () => {
  it("produces exact bytes and digest across temp roots, mtimes, locale/TZ, and discovery order", async () => {
    const fixtureA = await buildFixture("ui-registry-a-");
    const fixtureB = await buildFixture("ui-registry-b-");
    const rootA = fixtureA.source;
    const rootB = fixtureB.source;
    const outA = fixtureA.output;
    const outB = fixtureB.output;
    await utimes(join(rootA, "button/button.ts"), new Date(1_000), new Date(2_000));
    await utimes(join(rootB, "button/button.ts"), new Date(9_000_000), new Date(10_000_000));

    const oldTz = process.env.TZ;
    const oldLang = process.env.LANG;
    process.env.TZ = "Pacific/Honolulu";
    process.env.LANG = "tr_TR.UTF-8";
    const first = await buildRegistryArtifact(reorderedManifest(false), {
      repositoryRoot: fixtureA.repository,
      sourceRoot: rootA,
      outputDirectory: outA,
      evidence: evidenceResolver(conformance),
    });
    process.env.TZ = "Asia/Tokyo";
    process.env.LANG = "C";
    const second = await buildRegistryArtifact(reorderedManifest(true), {
      repositoryRoot: fixtureB.repository,
      sourceRoot: rootB,
      outputDirectory: outB,
      evidence: evidenceResolver(conformance),
    });
    process.env.TZ = oldTz;
    process.env.LANG = oldLang;

    expect(second.digest).toBe(first.digest);
    expect(Buffer.from(second.bytes).equals(Buffer.from(first.bytes))).toBe(true);
    expect(first.filename).toBe(`${first.digest}.registry.json`);
    expect(first.digest).toMatch(/^[a-f0-9]{64}$/);

    const expectedDigest = createHash(HASH_ALGORITHM)
      .update(Buffer.from(`${HASH_DOMAIN}\0${HASH_ALGORITHM}\0`, "utf8"))
      .update(first.bytes)
      .digest("hex");
    expect(first.digest).toBe(expectedDigest);

    const envelope = JSON.parse(Buffer.from(first.bytes).toString("utf8")) as MutableJson;
    expect(envelope.hash).toEqual({ algorithm: "sha256", domain: "ui-stdlib.registry-artifact/v1" });
    expect(envelope.reproducibility).toEqual({ scope: "same-host" });
    expect(envelope.files.map((file: MutableJson) => file.path)).toEqual([
      "button/button.css",
      "button/button.ts",
    ]);
    expect(await readFile(first.path)).toEqual(Buffer.from(first.bytes));
    expect((await readdir(outA)).filter((name) => name.includes(".tmp"))).toEqual([]);

    const repeated = await buildRegistryArtifact(reorderedManifest(true), {
      repositoryRoot: fixtureA.repository,
      sourceRoot: rootA,
      outputDirectory: outA,
      evidence: evidenceResolver(conformance),
    });
    expect(repeated.digest).toBe(first.digest);
    expect((await readdir(outA)).filter((name) => name.includes(".tmp"))).toEqual([]);
  });

  it("rejects symlinks anywhere in a portable source path", async () => {
    const fixture = await buildFixture("ui-registry-link-");
    const root = fixture.source;
    const output = fixture.output;
    await symlink("button.ts", join(root, "button/link.ts"));
    const manifest = JSON.parse(leafSource) as MutableJson;
    manifest.items[0].files = [{ path: "button/link.ts", type: "registry:ui", sha256: "0".repeat(64) }];

    await expect(
      buildRegistryArtifact(JSON.stringify(manifest), {
        repositoryRoot: fixture.repository,
        sourceRoot: root,
        outputDirectory: output,
        evidence: evidenceResolver(conformance),
      }),
    ).rejects.toMatchObject({ code: "source.symlink", portablePath: "button/link.ts" });
  });

  it("rejects the surrogate/replacement alias before input order can affect a digest", async () => {
    const repository = await temporaryRoot("ui-registry-unicode-alias-");
    const root = join(repository, "source");
    const output = join(repository, "output");
    await mkdir(root);
    await mkdir(output);
    const bytes = Buffer.from("one physical file\n");
    await writeFile(join(root, "\ufffd.ts"), bytes);
    const manifest = JSON.parse(leafSource) as MutableJson;
    manifest.items[0].files = [
      { path: "\ud800.ts", type: "registry:ui", sha256: createHash("sha256").update(bytes).digest("hex") },
      { path: "\ufffd.ts", type: "registry:ui", sha256: createHash("sha256").update(bytes).digest("hex") },
    ];

    for (const files of [manifest.items[0].files, [...manifest.items[0].files].reverse()]) {
      manifest.items[0].files = files;
      await expect(
        buildRegistryArtifact(JSON.stringify(manifest), {
          repositoryRoot: repository,
          sourceRoot: root,
          outputDirectory: output,
          evidence: evidenceResolver(conformance),
        }),
      ).rejects.toMatchObject({
        issues: expect.arrayContaining([
          expect.objectContaining({ code: "path.invalid-unicode" }),
        ]),
      });
    }
    expect(await readdir(output)).toEqual([]);
  });

  it("rejects source bytes changed after their manifest-bound evidence receipt", async () => {
    const fixture = await buildFixture("ui-registry-stale-evidence-");
    const root = fixture.source;
    const output = fixture.output;
    await writeFile(join(root, "button/button.ts"), "export const changed = true;\n");

    await expect(
      buildRegistryArtifact(leafSource, {
        repositoryRoot: fixture.repository,
        sourceRoot: root,
        outputDirectory: output,
        evidence: evidenceResolver(conformance),
      }),
    ).rejects.toMatchObject({
      code: "source.digest-mismatch",
      portablePath: "button/button.ts",
    });
  });

  it("binds source and output custody to physical repository descendants", async () => {
    const repository = await temporaryRoot("ui-registry-custody-");
    const outside = await populatedRoot("ui-registry-custody-outside-");
    const output = join(repository, "output");
    await symlink(outside, join(repository, "source"), "dir");

    await expect(
      buildRegistryArtifact(leafSource, {
        repositoryRoot: repository,
        sourceRoot: join(repository, "source"),
        outputDirectory: output,
        evidence: evidenceResolver(conformance),
      }),
    ).rejects.toMatchObject({ code: "source.symlink" });
    await expect(readdir(repository)).resolves.toEqual(["source"]);

    const source = join(repository, "real-source");
    await cp(fixtureSources, source, { recursive: true });
    const linkedOutput = join(repository, "linked-output");
    await symlink(outside, linkedOutput, "dir");
    await expect(
      buildRegistryArtifact(leafSource, {
        repositoryRoot: repository,
        sourceRoot: source,
        outputDirectory: linkedOutput,
        evidence: evidenceResolver(conformance),
      }),
    ).rejects.toMatchObject({ code: "output.symlink" });
    expect((await readdir(outside)).some((name) => name.endsWith(".registry.json"))).toBe(false);

    const outsideOutput = join(outside, "artifacts");
    await expect(
      buildRegistryArtifact(leafSource, {
        repositoryRoot: repository,
        sourceRoot: source,
        outputDirectory: outsideOutput,
        evidence: evidenceResolver(conformance),
      }),
    ).rejects.toMatchObject({ code: "output.escape" });
    await expect(readdir(outside)).resolves.not.toContain("artifacts");
  });
});
