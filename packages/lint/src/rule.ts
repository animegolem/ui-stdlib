import type { Rule } from "eslint";

import {
  CONTRACT_MESSAGE_ID,
  diagnosticOptionSchema,
  mergeDiagnostic,
  renderContractDiagnostic,
  type ContractDiagnostic,
  type ContractDiagnosticOverride
} from "./diagnostics.js";

export interface BaseRuleOptions {
  readonly diagnostic?: ContractDiagnosticOverride;
}

export type ReportableNode = Rule.Node | { readonly type: string };

export function createContractRule<TOptions extends BaseRuleOptions>(config: {
  readonly name: string;
  readonly description: string;
  readonly defaults: ContractDiagnostic;
  readonly optionProperties?: Readonly<Record<string, unknown>>;
  readonly create: (
    context: Rule.RuleContext,
    options: TOptions,
    report: (node: ReportableNode, diagnostic?: ContractDiagnosticOverride) => void
  ) => Rule.RuleListener;
}): Rule.RuleModule {
  return {
    meta: {
      type: "problem",
      docs: {
        description: config.description,
        url: `https://github.com/ui-stdlib/ui-stdlib/tree/main/packages/lint#${config.name}`
      },
      schema: [
        {
          type: "object",
          additionalProperties: false,
          properties: {
            diagnostic: diagnosticOptionSchema,
            ...config.optionProperties
          }
        }
      ],
      messages: {
        [CONTRACT_MESSAGE_ID]: "{{diagnostic}}"
      }
    },
    create(context) {
      const options = (context.options[0] ?? {}) as TOptions;
      const baseDiagnostic = mergeDiagnostic(config.defaults, options.diagnostic);
      const report = (
        node: ReportableNode,
        diagnosticOverride: ContractDiagnosticOverride | undefined = undefined
      ): void => {
        const diagnostic = mergeDiagnostic(baseDiagnostic, diagnosticOverride);
        context.report({
          node: node as Rule.Node,
          messageId: CONTRACT_MESSAGE_ID,
          data: { diagnostic: renderContractDiagnostic(diagnostic) }
        });
      };
      return config.create(context, options, report);
    }
  };
}
