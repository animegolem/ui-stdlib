export type ProvenanceRole = "recipe-source" | "interaction-source";
export type ProvenanceTreatment = "copied" | "adapted" | "reference";

export interface ProvenanceIdentity {
  readonly name: string;
  readonly source: string;
  readonly version: string;
  readonly sha256: string;
}

export interface ProvenanceEntry {
  readonly role: ProvenanceRole;
  readonly treatment: ProvenanceTreatment;
  readonly identity: ProvenanceIdentity;
  readonly license: {
    readonly spdx: string;
    readonly source: string;
  };
  readonly attribution: string;
  readonly changes?: readonly string[];
}

export interface RegistryFile {
  readonly path: string;
  readonly sha256: string;
  readonly content?: string;
  readonly type: string;
  readonly target?: string;
}

export interface RegistryItem {
  readonly manifestVersion: 1;
  readonly name: string;
  readonly type: string;
  readonly title?: string;
  readonly description?: string;
  readonly author?: string;
  readonly dependencies?: readonly string[];
  readonly devDependencies?: readonly string[];
  readonly registryDependencies?: readonly string[];
  readonly files: readonly RegistryFile[];
  readonly provenance: readonly ProvenanceEntry[];
  readonly cssTokens: {
    readonly consumes: readonly string[];
    readonly provides: readonly string[];
    readonly escapes: readonly {
      readonly scope: string;
      readonly property: string;
      readonly value: string;
      readonly reason: string;
      readonly rulingRef: string;
    }[];
  };
  readonly a11y: {
    readonly requirements: readonly {
      readonly id: string;
      readonly statement: string;
    }[];
    readonly tests: readonly string[];
  };
  readonly boundary: {
    readonly semantic: {
      readonly inputs: readonly string[];
      readonly events: readonly string[];
      readonly owns: readonly string[];
    };
    readonly domAdapter: {
      readonly owns: readonly string[];
    };
  };
  readonly reviewTier: "leaf" | "load-bearing";
  readonly reviewDeclaration: string;
  readonly declarationHealth:
    | { readonly status: "clean" }
    | {
        readonly status: "waived";
        readonly errorClasses: readonly string[];
        readonly rulingRef: string;
        readonly rationale: string;
      };
  readonly [key: string]: unknown;
}

export interface RegistryManifest {
  readonly $schema: "urn:ui-stdlib:schema:registry:v1";
  readonly schemaVersion: 1;
  readonly name: string;
  readonly homepage: string;
  readonly items: readonly RegistryItem[];
}

declare const admittedRegistry: unique symbol;

export type AdmittedRegistry = RegistryManifest & {
  readonly [admittedRegistry]: true;
};

export interface EvidenceBinding {
  readonly manifestSha256: string;
  readonly itemName: string;
}

export interface ConformanceRequest extends EvidenceBinding {
  readonly testName: string;
}

export interface ConformanceEvidence extends ConformanceRequest {
  readonly kind: "a11y-conformance";
  readonly status: "pass" | "fail";
  readonly runner: string;
  readonly invocation: string;
  readonly receiptSha256: string;
  readonly receiptBytes: Uint8Array;
}

export interface DeclarationHealthRequest extends EvidenceBinding {
  readonly declaration: RegistryItem["declarationHealth"];
}

export interface DeclarationHealthEvidence extends EvidenceBinding {
  readonly kind: "declaration-health";
  readonly status: "clean" | "waived";
  readonly skipLibCheck: false;
  readonly exitCode: number;
  readonly receiptSha256: string;
  readonly receiptBytes: Uint8Array;
  readonly errorClasses?: readonly string[];
  readonly rulingRef?: string;
}

export interface AdmissionEvidenceResolver {
  readonly resolveConformance: (
    request: ConformanceRequest,
  ) => ConformanceEvidence | undefined;
  readonly resolveDeclarationHealth: (
    request: DeclarationHealthRequest,
  ) => DeclarationHealthEvidence | undefined;
}

export interface AdmissionOptions {
  readonly evidence: AdmissionEvidenceResolver;
}

export interface AdmissionIssue {
  readonly code: string;
  readonly path: string;
  readonly message: string;
}

export interface ArtifactFile {
  readonly path: string;
  readonly bytes: string;
}

export interface RegistryArtifactEnvelope {
  readonly artifactVersion: 1;
  readonly reproducibility: {
    readonly scope: "same-host";
  };
  readonly hash: {
    readonly algorithm: "sha256";
    readonly domain: "ui-stdlib.registry-artifact/v1";
  };
  readonly manifest: RegistryManifest;
  readonly files: readonly ArtifactFile[];
}

export interface BuildOptions extends AdmissionOptions {
  readonly repositoryRoot: string;
  readonly sourceRoot: string;
  readonly outputDirectory: string;
}

export interface BuildResult {
  readonly digest: string;
  readonly filename: string;
  readonly path: string;
  readonly bytes: Uint8Array;
  readonly envelope: RegistryArtifactEnvelope;
}
