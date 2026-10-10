import { noArbitraryValues } from "./rules/no-arbitrary-values.js";
import { noInlineStyles } from "./rules/no-inline-styles.js";
import { noRawColors } from "./rules/no-raw-colors.js";
import { noRestyle } from "./rules/no-restyle.js";
import { noUnknownClassesTokens } from "./rules/no-unknown-classes-tokens.js";
import { requireStaticClasses } from "./rules/require-static-classes.js";

export const rules = {
  "no-raw-colors": noRawColors,
  "no-restyle": noRestyle,
  "no-arbitrary-values": noArbitraryValues,
  "no-inline-styles": noInlineStyles,
  "no-unknown-classes-tokens": noUnknownClassesTokens,
  "require-static-classes": requireStaticClasses
} as const;

export const configs = {
  recommended: {
    plugins: { "ui-stdlib": { rules } },
    rules: Object.fromEntries(
      Object.keys(rules).map((name) => [`ui-stdlib/${name}`, "error"])
    )
  }
} as const;

const plugin = { rules, configs };
export default plugin;

export {
  CONTRACT_MESSAGE_ID,
  mergeDiagnostic,
  renderContractDiagnostic
} from "./diagnostics.js";
export type {
  ContractDiagnostic,
  ContractDiagnosticOverride,
  DefinitionPointer
} from "./diagnostics.js";
export { scanCssRoot } from "./css-policy.js";
export type { CssPolicyDiagnostic } from "./css-policy.js";
