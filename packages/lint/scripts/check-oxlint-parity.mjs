import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const oxlintBinary = resolve(
  packageRoot,
  "node_modules/.bin",
  process.platform === "win32" ? "oxlint.cmd" : "oxlint"
);
const expectationPath = resolve(
  packageRoot,
  "fixtures/oxlint-parity.expected.json"
);
const expectation = JSON.parse(await readFile(expectationPath, "utf8"));
const corpus = [
  "fixtures/parity/no-raw-colors.tsx",
  "fixtures/parity/no-restyle.tsx",
  "fixtures/parity/no-arbitrary-values.tsx",
  "fixtures/parity/no-inline-styles.tsx",
  "fixtures/parity/no-unknown-classes-tokens.tsx",
  "fixtures/parity/require-static-classes.tsx"
];

if (corpus.length !== expectation.expected.corpusFiles) {
  throw new Error(
    `Oxlint parity corpus count ${corpus.length} does not match ${expectation.expected.corpusFiles}`
  );
}

const versionRun = spawnSync(oxlintBinary, ["--version"], {
  cwd: packageRoot,
  encoding: "utf8"
});
if (versionRun.status !== 0) {
  throw new Error(
    `Oxlint version check failed: ${versionRun.error?.message ?? versionRun.stderr?.trim() ?? "unknown error"}`
  );
}
const version = versionRun.stdout.trim().replace(/^(?:oxlint\s+|Version:\s*)/, "");
if (version !== expectation.tool.version) {
  throw new Error(
    `Oxlint parity requires exact ${expectation.tool.version}; found ${version}`
  );
}

const lintRun = spawnSync(
  oxlintBinary,
  ["--allow", "all", "--threads", "1", "--format", "json", ...corpus],
  { cwd: packageRoot, encoding: "utf8" }
);
const oxlintResult = lintRun.stdout.trim()
  ? JSON.parse(lintRun.stdout)
  : { diagnostics: [] };
const parserDiagnostics = Array.isArray(oxlintResult.diagnostics)
  ? oxlintResult.diagnostics.length
  : Number.NaN;

if (
  lintRun.status !== expectation.expected.exitCode ||
  parserDiagnostics !== expectation.expected.parserDiagnostics
) {
  throw new Error(
    `Oxlint parser parity failed: exit=${String(lintRun.status)} diagnostics=${parserDiagnostics}\n${lintRun.stderr}`
  );
}

const corpusReceipt = await Promise.all(
  corpus.map(async (path) => {
    const bytes = await readFile(resolve(packageRoot, path));
    return {
      path,
      sha256: createHash("sha256").update(bytes).digest("hex")
    };
  })
);

const receipt = {
  schemaVersion: expectation.schemaVersion,
  tool: { name: expectation.tool.name, version },
  authority: expectation.authority,
  scope: expectation.scope,
  status: "pass",
  customRuleExecution: expectation.customRuleExecution,
  limitation: expectation.limitation,
  result: {
    corpusFiles: corpus.length,
    exitCode: lintRun.status,
    parserDiagnostics
  },
  corpus: corpusReceipt
};

const receiptPath = resolve(packageRoot, expectation.receipt);
await mkdir(dirname(receiptPath), { recursive: true });
await writeFile(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, "utf8");

process.stdout.write(
  `${JSON.stringify({ receipt: relative(packageRoot, receiptPath), ...receipt }, null, 2)}\n`
);
