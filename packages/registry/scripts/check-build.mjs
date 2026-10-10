import { access, readFile } from "node:fs/promises";

const outputs = [
  new URL("../dist/index.js", import.meta.url),
  new URL("../dist/index.d.ts", import.meta.url),
];

for (const output of outputs) {
  await access(output);
  if ((await readFile(output)).byteLength === 0) {
    throw new Error(`registry build emitted an empty export: ${output.pathname}`);
  }
}
