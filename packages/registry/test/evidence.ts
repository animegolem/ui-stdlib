import { createHash } from "node:crypto";

import type {
  AdmissionEvidenceResolver,
  DeclarationHealthEvidence,
} from "../src/index.js";

export function receipt(body: Record<string, unknown>): {
  readonly receiptBytes: Uint8Array;
  readonly receiptSha256: string;
} {
  const receiptBytes = new TextEncoder().encode(JSON.stringify(body));
  return {
    receiptBytes,
    receiptSha256: createHash("sha256").update(receiptBytes).digest("hex"),
  };
}

export function evidenceResolver(
  results: Readonly<Record<string, "pass" | "fail">>,
): AdmissionEvidenceResolver {
  return {
    resolveConformance(request) {
      const status = results[request.testName];
      if (!status) return undefined;
      const body = {
        kind: "a11y-conformance",
        ...request,
        status,
        runner: "vitest@3.2.4",
        invocation: `fixture:${request.testName}`,
      } as const;
      return { ...body, ...receipt(body) };
    },
    resolveDeclarationHealth(request): DeclarationHealthEvidence {
      if (request.declaration.status === "clean") {
        const body = {
          kind: "declaration-health",
          manifestSha256: request.manifestSha256,
          itemName: request.itemName,
          status: "clean",
          skipLibCheck: false,
          exitCode: 0,
        } as const;
        return { ...body, ...receipt(body) };
      }
      const body = {
        kind: "declaration-health",
        manifestSha256: request.manifestSha256,
        itemName: request.itemName,
        status: "waived",
        skipLibCheck: false,
        exitCode: 1,
        errorClasses: request.declaration.errorClasses,
        rulingRef: request.declaration.rulingRef,
      } as const;
      return { ...body, ...receipt(body) };
    },
  };
}
