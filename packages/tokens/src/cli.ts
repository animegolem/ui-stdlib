import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { compileTokenCss } from "./compiler.js";
import { tokenSource } from "./token-source.js";

const outputPath = fileURLToPath(new URL("./tokens.css", import.meta.url));

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, compileTokenCss(tokenSource), "utf8");
