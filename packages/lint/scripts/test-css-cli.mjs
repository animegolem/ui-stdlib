import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const root = await mkdtemp(join(tmpdir(), "ui-css-cli-"));
try {
  await mkdir(join(root, "src"));
  await writeFile(join(root, "src/bad.css"), ".bad { color: #fff; }\n");
  const result = spawnSync(
    process.execPath,
    [join(packageRoot, "scripts/check-css-raw-colors.mjs"), root],
    { cwd: packageRoot, encoding: "utf8" },
  );
  if (result.status !== 1) throw new Error(`expected CLI exit 1, got ${result.status}: ${result.stderr}`);
  for (const required of [
    "src/bad.css:1:15",
    "Contract: colors resolve through the canonical --ui- token source.",
    "Approved alternative: reference an admitted var(--ui-*) token.",
    "Definition: packages/tokens/src/token-source.ts#canonical-token-source.",
  ]) {
    if (!result.stderr.includes(required)) {
      throw new Error(`CSS CLI diagnostic omitted ${JSON.stringify(required)}:\n${result.stderr}`);
    }
  }
  process.stdout.write("CSS CLI contract smoke: PASS\n");
} finally {
  await rm(root, { recursive: true, force: true });
}
