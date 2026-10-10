import type { Linter } from "eslint";

import type { ContractDiagnosticOverride } from "../src/diagnostics.js";
import type { rules } from "../src/index.js";

export interface RuleFixture {
  readonly rule: keyof typeof rules;
  readonly valid: string;
  readonly invalid: string;
  readonly options: Readonly<Record<string, unknown>> & {
    readonly diagnostic: ContractDiagnosticOverride;
  };
  readonly expectedMessage: string;
}

const diagnostic = (rule: keyof typeof rules): ContractDiagnosticOverride => ({
  contract: `fixture ${rule} contract`,
  approvedAlternative:
    rule === "no-unknown-classes-tokens" ? null : "use the fixture alternative",
  definition: {
    path: "fixtures/manifests/button.json",
    pointer: `#/contracts/${rule}`
  },
  componentManifest: "fixtures/manifests/button.json",
  sourceManifest: "fixtures/manifests/source.json",
  fix: `apply fixture ${rule} repair`
});

const message = (
  rule: keyof typeof rules,
  preciseFix: string = `apply fixture ${rule} repair`
): string => {
  const alternative =
    rule === "no-unknown-classes-tokens"
      ? "None approved; request contract review"
      : "use the fixture alternative";
  return `Contract: fixture ${rule} contract. Approved alternative: ${alternative}. Definition: fixtures/manifests/button.json#/contracts/${rule}. Component manifest: fixtures/manifests/button.json. Source manifest: fixtures/manifests/source.json. Precise fix: ${preciseFix}. Autofix: not authorized.`;
};

export const fixtures: readonly RuleFixture[] = [
  {
    rule: "no-raw-colors",
    valid: 'const tone = "var(--ui-color-text)";',
    invalid: 'const tone = "#fff";',
    options: { diagnostic: diagnostic("no-raw-colors") },
    expectedMessage: message(
      "no-raw-colors",
      "replace #fff with an admitted var(--ui-*) token"
    )
  },
  {
    rule: "no-restyle",
    valid: "const view = <Button variant=\"quiet\" />;",
    invalid: "const view = <Button class=\"quiet\" />;",
    options: {
      components: ["Button"],
      diagnostic: diagnostic("no-restyle")
    },
    expectedMessage: message("no-restyle")
  },
  {
    rule: "no-arbitrary-values",
    valid: "const view = <div class=\"p-2\" />;",
    invalid: "const view = <div class=\"w-[13px]\" />;",
    options: { diagnostic: diagnostic("no-arbitrary-values") },
    expectedMessage: message("no-arbitrary-values")
  },
  {
    rule: "no-inline-styles",
    valid: "const view = <div style={{ width: paneWidth }} />;",
    invalid: "const view = <div style={{ color: tone }} />;",
    options: {
      allowedProperties: ["width"],
      diagnostic: diagnostic("no-inline-styles")
    },
    expectedMessage: message("no-inline-styles")
  },
  {
    rule: "no-unknown-classes-tokens",
    valid: "const view = <div class=\"surface\" />;",
    invalid: "const view = <div class=\"mystery\" />;",
    options: {
      knownClasses: ["surface"],
      knownTokens: ["--ui-color-text"],
      diagnostic: diagnostic("no-unknown-classes-tokens")
    },
    expectedMessage: message(
      "no-unknown-classes-tokens",
      "replace mystery with a declared class or request manifest review"
    )
  },
  {
    rule: "require-static-classes",
    valid: "const view = <div classList={{ selected: active }} />;",
    invalid: "const view = <div classList={{ [tone()]: true }} />;",
    options: {
      namedVariants: ["buttonVariants"],
      diagnostic: diagnostic("require-static-classes")
    },
    expectedMessage: message("require-static-classes")
  }
] as const;

export const languageOptions: Linter.LanguageOptions = {
  ecmaVersion: 2022,
  sourceType: "module",
  parserOptions: { ecmaFeatures: { jsx: true } }
};
