import { Linter } from "eslint";
import { describe, expect, it } from "vitest";

import plugin, { rules } from "../src/index.js";
import { fixtures, languageOptions } from "./fixtures.js";

function verify(
  code: string,
  rule: keyof typeof rules,
  options: Readonly<Record<string, unknown>>
): Linter.LintMessage[] {
  const linter = new Linter({ configType: "flat" });
  return linter.verify(
    code,
    [
      {
        files: ["**/*.tsx"],
        languageOptions,
        plugins: { "ui-stdlib": plugin },
        rules: { [`ui-stdlib/${rule}`]: ["error", options] }
      }
    ],
    { filename: "src/fixture.tsx" }
  );
}

describe("six authoritative ESLint rule families", () => {
  it("exports exactly the six ruled families", () => {
    expect(Object.keys(rules)).toEqual([
      "no-raw-colors",
      "no-restyle",
      "no-arbitrary-values",
      "no-inline-styles",
      "no-unknown-classes-tokens",
      "require-static-classes"
    ]);
  });

  for (const fixture of fixtures) {
    it(`${fixture.rule}: accepts its valid fixture`, () => {
      expect(verify(fixture.valid, fixture.rule, fixture.options)).toEqual([]);
    });

    it(`${fixture.rule}: emits its exact contract diagnostic`, () => {
      const messages = verify(fixture.invalid, fixture.rule, fixture.options);
      expect(messages).toHaveLength(1);
      expect(messages[0]).toMatchObject({
        ruleId: `ui-stdlib/${fixture.rule}`,
        severity: 2,
        message: fixture.expectedMessage
      });
      expect(messages[0]).not.toHaveProperty("fix");
      expect(messages[0]).not.toHaveProperty("suggestions");
    });
  }

  it("no-raw-colors covers CSS hex, rgb, hsl, oklab, and oklch literals", () => {
    const fixture = fixtures[0];
    const syntaxes = ["#123456", "rgb(1 2 3)", "hsl(2 3% 4%)", "oklab(.5 .1 .1)", "oklch(50% .2 20)", "red"];
    for (const syntax of syntaxes) {
      expect(verify(`const tone = ${JSON.stringify(syntax)};`, fixture.rule, fixture.options)).toHaveLength(1);
    }
  });

  it("the combined unknown family checks --ui- token references", () => {
    const fixture = fixtures[4];
    const [message] = verify(
      'const tone = "var(--ui-color-missing)";',
      fixture.rule,
      fixture.options
    );
    expect(
      verify(
        'const view = <div class="var(--ui-color-missing)" />;',
        fixture.rule,
        fixture.options
      )
    ).toHaveLength(1);
    expect(message?.message).toContain(
      "Precise fix: replace --ui-color-missing with a declared --ui- token or request manifest review."
    );
    expect(
      verify(
        "const tone = `var(--ui-color-missing)`;",
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        "const tone = `var(--ui-${toneName})`;",
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(--ui-" + toneName + ")";',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = `var(${"--ui-" + toneName})`;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(" + "--ui-" + toneName + ")";',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = `var(${flag ? "--ui-missing" : "--ui-other"})`;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = `var(${"--ui-".concat(toneName)})`;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(".concat("--ui-", toneName, ")");',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(" + "--ui-missing" + ")";',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(".concat("--ui-missing", ")");',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = `var(${"--ui-missing"})`;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const pieces = [].concat("var(", "--ui-", toneName, ")");',
        fixture.rule,
        fixture.options,
      ),
    ).toEqual([]);
    expect(
      verify(
        'const tone = "prefix " + "var(".concat("--ui-", toneName, ")");',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = `prefix ${"var(".concat("--ui-", toneName, ")")}`;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(verify('const tone = "var( --ui-missing )";', fixture.rule, fixture.options)).toHaveLength(1);
    expect(
      verify(
        'const tone = "var(--ui-color-text,var(--ui-missing))";',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const view = <div class="bogus-var(--ui-color-text)" />;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const view = <div color="var(--ui-missing)" />;',
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const tone = "var( --ui-color-text, var(--ui-color-text))";',
        fixture.rule,
        fixture.options,
      ),
    ).toEqual([]);
  });

  it("inline geometry escapes are manifest-fed, static-keyed, and still color-safe", () => {
    const fixture = fixtures[3];
    expect(
      verify(
        "const view = <div style={{ width: paneWidth, height: paneHeight }} />;",
        fixture.rule,
        { ...fixture.options, allowedProperties: ["width", "height"] }
      )
    ).toEqual([]);
    expect(
      verify(
        "const view = <div style={{ [property]: paneWidth }} />;",
        fixture.rule,
        fixture.options
      )
    ).toHaveLength(1);
    expect(
      verify(
        'const view = <div style={{ width: "oklch(50% .2 20)" }} />;',
        fixture.rule,
        fixture.options
      )
    ).toHaveLength(1);
  });

  it("require-static-classes admits dynamic values through a named variant only", () => {
    const fixture = fixtures[5];
    expect(
      verify(
        "const view = <div classList={buttonVariants({ tone })} />;",
        fixture.rule,
        fixture.options
      )
    ).toEqual([]);
    expect(
      verify("const view = <div classList={classes} />;", fixture.rule, fixture.options)
    ).toHaveLength(1);
    expect(
      verify(
        'const view = <div classList={{ ["selected"]: active }} />;',
        fixture.rule,
        fixture.options,
      ),
    ).toEqual([]);
    expect(
      verify(
        "const view = <div classList={{ [tone()]: active }} />;",
        fixture.rule,
        fixture.options,
      ),
    ).toHaveLength(1);
  });

  it("applies restyle, arbitrary-value, and manifest allowlist laws to Solid classList keys", () => {
    expect(
      verify(
        'const view = <Button classList={{ rogue: true }} />;',
        "no-restyle",
        fixtures[1]!.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        'const view = <div classList={{ "w-[13px]": true }} />;',
        "no-arbitrary-values",
        fixtures[2]!.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        "const view = <div classList={{ mystery: active }} />;",
        "no-unknown-classes-tokens",
        fixtures[4]!.options,
      ),
    ).toHaveLength(1);
    expect(
      verify(
        "const view = <div classList={{ surface: active }} />;",
        "no-unknown-classes-tokens",
        fixtures[4]!.options,
      ),
    ).toEqual([]);
    expect(
      verify(
        'const view = <div classList={{ ["surface"]: active }} />;',
        "no-unknown-classes-tokens",
        fixtures[4]!.options,
      ),
    ).toEqual([]);
  });
});
