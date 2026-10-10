import { pathToFileURL } from "node:url";

import { scanCssRoot } from "../dist/css-policy.js";
import { mergeDiagnostic, renderContractDiagnostic } from "../dist/diagnostics.js";
import { RAW_COLOR_DIAGNOSTIC } from "../dist/rules/no-raw-colors.js";

async function main() {
  const root = process.argv[2] ?? process.cwd();
  const diagnostics = await scanCssRoot(root);
  for (const diagnostic of diagnostics) {
    const contract = renderContractDiagnostic(mergeDiagnostic(RAW_COLOR_DIAGNOSTIC, {
      fix: `replace ${diagnostic.value} with an admitted var(--ui-*) token`,
    }));
    console.error(
      `${diagnostic.path}:${diagnostic.line}:${diagnostic.column} ${contract}`,
    );
  }
  if (diagnostics.length > 0) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
