import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

import { scanCssRoot } from "../src/css-policy.js";

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("CSS raw-color carrier", () => {
  it("scans authored CSS and reports exact source positions", async () => {
    const root = await mkdtemp(join(tmpdir(), "ui-css-policy-"));
    roots.push(root);
    await mkdir(join(root, "src"), { recursive: true });
    await writeFile(join(root, "src/good.css"), ".good { color: var(--ui-color-text); }\n");
    await writeFile(join(root, "src/bad.css"), ".bad { color: #fff; }\n");
    await writeFile(join(root, "src/named.css"), ".named { border-color: red; }\n");
    await writeFile(
      join(root, "src/non-color.css"),
      '#fff { content: "#fff"; animation-name: blue; background: url(image.svg#fff); color: var(--ui-color-red); }\n',
    );
    await writeFile(
      join(root, "src/fallback.css"),
      ".fallback { color: var(--ui-color-text, red); filter: drop-shadow(0 0 3px blue); }\n",
    );
    await writeFile(
      join(root, "src/lexical.css"),
      '.a { content: "; color: blue;"; background: url("pic(foo)#fff.svg"); color: red; }\n',
    );

    expect(await scanCssRoot(root)).toMatchObject([
      { path: "src/bad.css", line: 1, syntax: "hex", value: "#fff" },
      { path: "src/fallback.css", line: 1, syntax: "named", value: "red" },
      { path: "src/fallback.css", line: 1, syntax: "named", value: "blue" },
      { path: "src/lexical.css", line: 1, syntax: "named", value: "red" },
      { path: "src/named.css", line: 1, syntax: "named", value: "red" },
    ]);
  });
});
