import { createHash, randomUUID } from "node:crypto";
import {
  link,
  lstat,
  mkdir,
  readFile,
  realpath,
  unlink,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

import { canonicalize } from "json-canonicalize";

import { admitRegistry } from "./admission.js";
import { RegistryBuildError } from "./errors.js";
import type {
  ArtifactFile,
  BuildOptions,
  BuildResult,
  RegistryArtifactEnvelope,
  RegistryFile,
} from "./types.js";

export const ARTIFACT_VERSION = 1 as const;
export const HASH_ALGORITHM = "sha256" as const;
export const HASH_DOMAIN = "ui-stdlib.registry-artifact/v1" as const;

function compareText(left: string, right: string): number {
  return Buffer.compare(Buffer.from(left, "utf8"), Buffer.from(right, "utf8"));
}

function isContained(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (
    pathFromRoot !== ".." && !pathFromRoot.startsWith(`..${sep}`) && !isAbsolute(pathFromRoot)
  );
}

async function bindRepositoryRoot(path: string): Promise<{ lexical: string; physical: string }> {
  const lexical = resolve(path);
  let stat;
  try {
    stat = await lstat(lexical);
  } catch (error) {
    throw new RegistryBuildError(
      "repository.invalid-root",
      `Repository root does not resolve: ${lexical}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
  if (stat.isSymbolicLink()) {
    throw new RegistryBuildError("repository.unsafe-root", `Repository root cannot be a symbolic link: ${lexical}`);
  }
  if (!stat.isDirectory()) {
    throw new RegistryBuildError("repository.invalid-root", `Repository root is not a directory: ${lexical}`);
  }
  return { lexical, physical: await realpath(lexical) };
}

async function bindExistingDescendant(
  repository: { lexical: string; physical: string },
  path: string,
  label: string,
): Promise<string> {
  const lexical = resolve(path);
  if (!isContained(repository.lexical, lexical)) {
    throw new RegistryBuildError(`${label}.escape`, `${label} must be inside the repository root: ${lexical}`);
  }
  const pathFromRoot = relative(repository.lexical, lexical);
  let cursor = repository.lexical;
  for (const segment of pathFromRoot === "" ? [] : pathFromRoot.split(sep)) {
    cursor = join(cursor, segment);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch (error) {
      throw new RegistryBuildError(
        `${label}.missing`,
        `${label} does not resolve: ${cursor}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    if (stat.isSymbolicLink()) {
      throw new RegistryBuildError(`${label}.symlink`, `${label} cannot traverse a symbolic link: ${cursor}`);
    }
    if (!stat.isDirectory()) {
      throw new RegistryBuildError(`${label}.not-directory`, `${label} ancestor is not a directory: ${cursor}`);
    }
  }
  const physical = await realpath(lexical);
  if (!isContained(repository.physical, physical)) {
    throw new RegistryBuildError(`${label}.escape`, `${label} resolves outside the repository root: ${physical}`);
  }
  return physical;
}

async function createBoundDirectory(
  repository: { lexical: string; physical: string },
  path: string,
  label: string,
): Promise<string> {
  const lexical = resolve(path);
  if (!isContained(repository.lexical, lexical)) {
    throw new RegistryBuildError(`${label}.escape`, `${label} must be inside the repository root: ${lexical}`);
  }
  const pathFromRoot = relative(repository.lexical, lexical);
  let cursor = repository.lexical;
  for (const segment of pathFromRoot === "" ? [] : pathFromRoot.split(sep)) {
    cursor = join(cursor, segment);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await mkdir(cursor);
      stat = await lstat(cursor);
    }
    if (stat.isSymbolicLink()) {
      throw new RegistryBuildError(`${label}.symlink`, `${label} cannot traverse a symbolic link: ${cursor}`);
    }
    if (!stat.isDirectory()) {
      throw new RegistryBuildError(`${label}.not-directory`, `${label} ancestor is not a directory: ${cursor}`);
    }
  }
  const physical = await realpath(lexical);
  if (!isContained(repository.physical, physical)) {
    throw new RegistryBuildError(`${label}.escape`, `${label} resolves outside the repository root: ${physical}`);
  }
  return physical;
}

async function readPortableFile(sourceRoot: string, file: RegistryFile): Promise<Uint8Array> {
  if (file.content !== undefined) return Buffer.from(file.content, "utf8");

  const segments = file.path.split("/");
  let cursor = sourceRoot;
  for (const segment of segments) {
    cursor = join(cursor, segment);
    let stat;
    try {
      stat = await lstat(cursor);
    } catch (error) {
      throw new RegistryBuildError(
        "source.missing",
        `Cannot read portable source ${file.path}: ${error instanceof Error ? error.message : String(error)}`,
        file.path,
      );
    }
    if (stat.isSymbolicLink()) {
      throw new RegistryBuildError("source.symlink", `Portable source cannot traverse a symbolic link: ${file.path}`, file.path);
    }
  }

  const rootReal = await realpath(sourceRoot);
  const fileReal = await realpath(cursor);
  const escaped = relative(rootReal, fileReal);
  if (escaped === ".." || escaped.startsWith(`..${sep}`) || isAbsolute(escaped)) {
    throw new RegistryBuildError("source.escape", `Portable source escaped its source root: ${file.path}`, file.path);
  }
  const finalStat = await lstat(fileReal);
  if (!finalStat.isFile()) {
    throw new RegistryBuildError("source.not-file", `Portable source is not a regular file: ${file.path}`, file.path);
  }
  return readFile(fileReal);
}

async function publishAtomically(target: string, bytes: Uint8Array): Promise<void> {
  try {
    const targetStat = await lstat(target);
    if (targetStat.isSymbolicLink() || !targetStat.isFile()) {
      throw new RegistryBuildError("output.unsafe-target", `Artifact target is not a regular file: ${target}`);
    }
    const existing = await readFile(target);
    if (!existing.equals(Buffer.from(bytes))) {
      throw new RegistryBuildError("output.digest-collision", `Existing digest-named artifact has different bytes: ${target}`);
    }
    return;
  } catch (error) {
    if (error instanceof RegistryBuildError) throw error;
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }

  const temporary = join(dirname(target), `.${target.split(sep).at(-1)}.${process.pid}.${randomUUID()}.tmp`);
  try {
    await writeFile(temporary, bytes, { flag: "wx", mode: 0o644 });
    try {
      // A same-directory hard link publishes complete bytes without replacing a concurrent writer.
      await link(temporary, target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      const existing = await readFile(target);
      if (!existing.equals(Buffer.from(bytes))) {
        throw new RegistryBuildError("output.digest-collision", `Concurrent artifact has different bytes: ${target}`);
      }
    }
  } finally {
    await unlink(temporary).catch(() => undefined);
  }
}

/**
 * Builds the same-host reproducible v1 artifact. Cross-OS byte identity is not
 * claimed until CI supplies a parity receipt.
 */
export async function buildRegistryArtifact(
  source: string | Uint8Array,
  options: BuildOptions,
): Promise<BuildResult> {
  // Bind every caller-selected filesystem authority before parsing or writing.
  // Descendant links are refused rather than canonicalized into a new identity.
  const repository = await bindRepositoryRoot(options.repositoryRoot);
  const sourceRoot = await bindExistingDescendant(repository, options.sourceRoot, "source");

  // Deliberately reuse the sole parser/admission boundary; build has no parser.
  const manifest = admitRegistry(source, { evidence: options.evidence });

  const files: ArtifactFile[] = [];
  for (const item of manifest.items) {
    for (const file of item.files) {
      const bytes = await readPortableFile(sourceRoot, file);
      const sourceDigest = createHash("sha256").update(bytes).digest("hex");
      if (sourceDigest !== file.sha256) {
        throw new RegistryBuildError(
          "source.digest-mismatch",
          `Portable source digest does not match its admitted manifest: ${file.path}`,
          file.path,
        );
      }
      files.push({ path: file.path, bytes: Buffer.from(bytes).toString("base64") });
    }
  }
  files.sort((left, right) => compareText(left.path, right.path));

  const envelope: RegistryArtifactEnvelope = {
    artifactVersion: ARTIFACT_VERSION,
    reproducibility: { scope: "same-host" },
    hash: { algorithm: HASH_ALGORITHM, domain: HASH_DOMAIN },
    manifest,
    files,
  };
  const artifactBytes = Buffer.from(canonicalize(envelope), "utf8");
  const preimage = Buffer.concat([
    Buffer.from(`${HASH_DOMAIN}\0${HASH_ALGORITHM}\0`, "utf8"),
    artifactBytes,
  ]);
  const digest = createHash(HASH_ALGORITHM).update(preimage).digest("hex");
  const filename = `${digest}.registry.json`;

  const outputDirectory = await createBoundDirectory(repository, options.outputDirectory, "output");
  const outputPath = join(outputDirectory, filename);
  await publishAtomically(outputPath, artifactBytes);

  return { digest, filename, path: outputPath, bytes: artifactBytes, envelope };
}
