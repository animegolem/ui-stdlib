import { describe, expect, it } from "vitest";

import {
  findRawColors,
  findRawColorsInCssFile,
  findRawColorsInFile,
  isRawColorPolicyExemptPath
} from "../src/raw-color-policy.js";

describe("shared raw-color policy", () => {
  it("recognizes authored CSS color-literal syntax, not only hex", () => {
    expect(
      findRawColors(
        "#f00 rgb(1 2 3) hsl(20 30% 40%) oklab(.5 .1 .1) oklch(50% .2 20)"
      )
    ).toMatchObject([
      { syntax: "hex", value: "#f00", index: 0 },
      { syntax: "rgb", value: "rgb(", index: 5 },
      { syntax: "hsl", value: "hsl(", index: 16 },
      { syntax: "oklab", value: "oklab(", index: 32 },
      { syntax: "oklch", value: "oklch(", index: 48 }
    ]);
    expect(findRawColors("red")).toMatchObject([
      { syntax: "named", value: "red", index: 0 }
    ]);
  });

  it("exempts only the canonical source and its generated artifact", () => {
    expect(isRawColorPolicyExemptPath("packages/tokens/src/token-source.ts")).toBe(true);
    expect(isRawColorPolicyExemptPath("packages/tokens/dist/tokens.css")).toBe(true);
    expect(findRawColorsInFile("#fff", "src/button.tsx")).toHaveLength(1);
    expect(
      findRawColorsInFile("#fff", "/repo/packages/tokens/src/token-source.ts")
    ).toEqual([]);
  });

  it("finds named colors inside authored CSS declarations", () => {
    expect(findRawColorsInCssFile(".x { border-color: red; }", "src/x.css")).toMatchObject([
      { syntax: "named", value: "red" }
    ]);
    expect(
      findRawColorsInCssFile(
        ".x { color: var(--ui-color-red); } /* border-color: blue */",
        "src/x.css"
      )
    ).toEqual([]);
  });

  it("ignores named-color words outside authored color values", () => {
    expect(
      findRawColorsInCssFile(
        '.x { content: "red"; animation-name: blue; color: var(--ui-color-red); }',
        "src/x.css",
      ),
    ).toEqual([]);
    expect(
      findRawColorsInCssFile(".x { background: url(red.svg); }", "src/x.css"),
    ).toEqual([]);
    expect(
      findRawColorsInCssFile(".x { border-color: red; }", "src/x.css"),
    ).toMatchObject([{ syntax: "named", value: "red" }]);
  });

  it("keeps color fallbacks visible while excluding selectors, strings, and URL fragments", () => {
    expect(
      findRawColorsInCssFile(
        ".x { color: var(--ui-color-text, red); filter: drop-shadow(0 0 3px blue); }",
        "src/x.css",
      ),
    ).toMatchObject([
      { syntax: "named", value: "red" },
      { syntax: "named", value: "blue" },
    ]);
    expect(
      findRawColorsInCssFile(
        '#fff { content: "#fff"; background: url(image.svg#fff); color: var(--ui-color-text); }',
        "src/x.css",
      ),
    ).toEqual([]);
  });

  it("establishes string, comment, and URL boundaries before recognizing declarations", () => {
    const fixtures: ReadonlyArray<readonly [string, number]> = [
      ['.a { content: "; color: red;"; }', 0],
      ['.a { content: "{ color: red; }"; }', 0],
      ['.a { background: url("data:image/svg+xml;utf8,<svg fill=\'#fff\'/>"); }', 0],
      ['.a { content: "/*"; color: red; } .b { content:"*/"; }', 1],
      ['.a { background: url("pic(foo)#fff.svg"); }', 0],
      ['.a { color: var(--ui-known, red); }', 1],
      ['.a { filter: drop-shadow(0 0 3px blue); }', 1],
      ['#fff { color: var(--ui-known); }', 0],
      ['.a { content: "#fff"; }', 0],
      ['.a { background: url(image.svg#fff); }', 0],
      ['.a { content: ";"; color: #fff; }', 1],
    ];
    for (const [css, expectedCount] of fixtures) {
      expect(findRawColorsInCssFile(css, "src/x.css"), css).toHaveLength(expectedCount);
    }
  });

  it("implements CSS string escaped-newline continuation with source-exact offsets", () => {
    const continuations: ReadonlyArray<
      readonly [label: string, newline: string, expectedIndex: number]
    > = [
      ["LF", "\n", 44],
      ["CRLF", "\r\n", 45],
      ["CR", "\r", 44],
      ["FF", "\f", 44],
    ];

    for (const [label, newline, expectedIndex] of continuations) {
      const css = `.a { content: "text\\${newline}; color: red;"; color: blue; }`;
      expect(findRawColorsInCssFile(css, "src/x.css"), label).toEqual([
        { value: "blue", syntax: "named", index: expectedIndex, length: 4 },
      ]);
    }

    const continuedCrLf = `.a { content: "text\\\r\nstill"; color: red; }`;
    expect(findRawColorsInCssFile(continuedCrLf, "src/x.css")).toEqual([
      { value: "red", syntax: "named", index: 37, length: 3 },
    ]);
  });

  it("consumes simple and hexadecimal escaped code points by CSS Syntax 3", () => {
    const escapedQuote = `.a { content: "text\\\"; color: red;"; color: blue; }`;
    expect(findRawColorsInCssFile(escapedQuote, "src/x.css")).toEqual([
      { value: "blue", syntax: "named", index: 44, length: 4 },
    ]);

    const hexEscapeWithCrLfWhitespace = `.a { content: "text\\22\r\n; color: red;"; color: blue; }`;
    expect(findRawColorsInCssFile(hexEscapeWithCrLfWhitespace, "src/x.css")).toEqual([
      { value: "blue", syntax: "named", index: 47, length: 4 },
    ]);
  });
});
