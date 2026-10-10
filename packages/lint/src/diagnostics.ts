export interface DefinitionPointer {
  /** Repository-relative path. */
  readonly path: string;
  /** JSON Pointer (for example, #/contracts/style) or an anchor. */
  readonly pointer: string;
}

export interface ContractDiagnostic {
  readonly contract: string;
  readonly approvedAlternative: string | null;
  readonly definition: DefinitionPointer;
  readonly componentManifest: string;
  readonly sourceManifest: string;
  readonly fix: string;
}

export type ContractDiagnosticOverride = Partial<{
  contract: string;
  approvedAlternative: string | null;
  definition: Partial<DefinitionPointer>;
  componentManifest: string;
  sourceManifest: string;
  fix: string;
}>;

export const CONTRACT_MESSAGE_ID = "contractViolation" as const;

export function mergeDiagnostic(
  defaults: ContractDiagnostic,
  override: ContractDiagnosticOverride | undefined
): ContractDiagnostic {
  return {
    ...defaults,
    ...override,
    definition: {
      ...defaults.definition,
      ...override?.definition
    }
  };
}

export function renderContractDiagnostic(diagnostic: ContractDiagnostic): string {
  const alternative =
    diagnostic.approvedAlternative ?? "None approved; request contract review";

  return [
    `Contract: ${diagnostic.contract}.`,
    `Approved alternative: ${alternative}.`,
    `Definition: ${diagnostic.definition.path}${diagnostic.definition.pointer}.`,
    `Component manifest: ${diagnostic.componentManifest}.`,
    `Source manifest: ${diagnostic.sourceManifest}.`,
    `Precise fix: ${diagnostic.fix}.`,
    "Autofix: not authorized."
  ].join(" ");
}

export const diagnosticOptionSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    contract: { type: "string", minLength: 1 },
    approvedAlternative: { anyOf: [{ type: "string", minLength: 1 }, { type: "null" }] },
    definition: {
      type: "object",
      additionalProperties: false,
      properties: {
        path: { type: "string", minLength: 1 },
        pointer: { type: "string", pattern: "^#" }
      }
    },
    componentManifest: { type: "string", minLength: 1 },
    sourceManifest: { type: "string", minLength: 1 },
    fix: { type: "string", minLength: 1 }
  }
} as const;
