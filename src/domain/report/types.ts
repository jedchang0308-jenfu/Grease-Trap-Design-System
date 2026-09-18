export interface SnapshotCase {
  id: string;
  caseGroupId: string;
  caseNo: string;
  revisionNo: number;
  customer: string;
  location: string;
  title: string;
  purpose: string;
  taskCode: string;
  mode: string;
  lifecycleStatus: string;
  calculationStatus: string;
}

export const REPORT_NUMBER_PLACEHOLDER = "TBD";

export type ReportDocumentKind = "DRAFT" | "FORMAL";

export interface SnapshotRun {
  id: string;
  track: string;
  methodCode: string;
  semantics: string;
  inputHash: string;
  raw: Record<string, string | null>;
  adopted: Record<string, string | null>;
  ruleSet: {
    code: string;
    version: string;
    checksum: string;
    sourceCode: string;
    sourceTitle: string;
    sourceHash: string;
  };
  steps: Array<{
    sequence: number;
    formulaCode: string;
    expression: string;
    substitution: string;
    result: string;
    unit: string;
    sourceRef: string;
  }>;
  warnings: Array<{
    code: string;
    severity: string;
    message: string;
    details: unknown;
  }>;
}

export interface ReportSnapshotData {
  schemaVersion: "2.0";
  reportNumber: string;
  case: SnapshotCase;
  inputs: unknown;
  assessments: Array<{
    track: string;
    status: string;
    missingFields: string[];
    errors: string[];
    releaseRelevance: string;
  }>;
  runs: SnapshotRun[];
  overrides: Array<{
    resultPath: string;
    beforeValue: unknown;
    afterValue: unknown;
    reason: string;
    evidence: string;
    requestedBy: string;
    approvedBy: string;
  }>;
  actors: { preparedBy: string; exportedBy: string };
}
