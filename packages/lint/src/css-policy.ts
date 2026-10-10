import { readdir, readFile } from "node:fs/promises";
import { relative, resolve } from "node:path";

import {
  findRawColorsInCssFile,
  type RawColorMatch,
} from "@ui-stdlib/tokens/raw-color-policy.js";

const SKIPPED_DIRECTORIES = new Set([
  ".git",
  ".workspaces",
  ".codex",
  "coverage",
  "dist",
  "node_modules",
  "playwright-report",
  "test-results",
]);

export interface CssPolicyDiagnostic extends RawColorMatch {
  readonly path: string;
  readonly line: number;
  readonly column: number;
}

async function cssFiles(directory: string): Promise<readonly string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_DIRECTORIES.has(entry.name)) files.push(...await cssFiles(path));
    } else if (entry.isFile() && entry.name.endsWith(".css")) {
      files.push(path);
    }
  }
  return files;
}

export async function scanCssRoot(rootPath: string): Promise<readonly CssPolicyDiagnostic[]> {
  const root = resolve(rootPath);
  const diagnostics: CssPolicyDiagnostic[] = [];
  for (const path of [...await cssFiles(root)].sort()) {
    const repoPath = relative(root, path).replaceAll("\\", "/");
    const source = await readFile(path, "utf8");
    for (const match of findRawColorsInCssFile(source, repoPath)) {
      const before = source.slice(0, match.index);
      diagnostics.push({
        path: repoPath,
        line: before.split("\n").length,
        column: match.index - before.lastIndexOf("\n"),
        ...match,
      });
    }
  }
  return diagnostics;
}
