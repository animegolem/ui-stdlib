import type { AdmissionIssue } from "./types.js";

export class RegistryAdmissionError extends Error {
  readonly issues: readonly AdmissionIssue[];

  constructor(issues: readonly AdmissionIssue[]) {
    super(
      `Registry admission failed with ${issues.length} issue${issues.length === 1 ? "" : "s"}: ` +
        issues.map((issue) => `${issue.code} at ${issue.path}`).join(", "),
    );
    this.name = "RegistryAdmissionError";
    this.issues = issues;
  }
}

export class RegistryBuildError extends Error {
  readonly code: string;
  readonly portablePath: string | undefined;

  constructor(code: string, message: string, portablePath?: string) {
    super(message);
    this.name = "RegistryBuildError";
    this.code = code;
    this.portablePath = portablePath;
  }
}
