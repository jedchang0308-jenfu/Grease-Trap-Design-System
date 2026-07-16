import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import type { ReportSnapshotData, SnapshotRun } from "@/domain/report/types";
import type { TrackStatus } from "@/domain/calculation/orchestration";

export interface PersistedCalculation extends SnapshotRun {
  createdAt: string;
}

export interface PersistedAssessment {
  track: "CURRENT_QG" | "LEGACY_QV";
  status: TrackStatus;
  requiredFields: string[];
  missingFields: string[];
  errors: string[];
  ruleSetVersion: string;
  releaseRelevance: string;
  assessedAt: string;
}

export interface PersistedOverride {
  id: string;
  resultPath: string;
  beforeValue: unknown;
  afterValue: unknown;
  reason: string;
  evidence: string;
  status: "APPROVED";
  requestedBy: string;
  approvedBy: string;
  createdAt: string;
}

export interface PersistedReview {
  preparedBy: string;
  reviewedBy: string;
  checklist: Record<string, boolean>;
  decision: "APPROVED" | "RETURNED";
  note: string;
  reviewedAt: string;
}

export interface ReportSummary {
  id: string;
  snapshotHash: string;
  reportNumber: string;
  status: "ISSUED";
  storagePath: string;
  issuedAt: string;
}

export interface CalculationRequestCache {
  payloadHash: string;
  response: unknown;
  createdAt: string;
}

export interface CaseRecord {
  id: string;
  case_group_id: string;
  case_no: string;
  revision_no: number;
  customer: string;
  location: string;
  title: string;
  purpose: string;
  dining_type: string | null;
  task_code: string;
  mode: string;
  lifecycle_status: string;
  calculation_status: string | null;
  input_payload: {
    currentInputs?: Record<string, unknown>;
    legacyInputs?: Record<string, unknown>;
  };
  version: number;
  created_by: string;
  created_by_name: string;
  prepared_by: string | null;
  prepared_by_name: string | null;
  reviewed_by: string | null;
  reviewed_by_name: string | null;
  issued_by: string | null;
  issued_by_name: string | null;
  created_at: string;
  updated_at: string;
  calculations: PersistedCalculation[];
  assessments: PersistedAssessment[];
  overrides: PersistedOverride[];
  review: PersistedReview | null;
  reports: ReportSummary[];
  latestReportId: string | null;
  calculationRequests: Record<string, CalculationRequestCache>;
}

export interface ReportRecord extends ReportSummary {
  caseGroupId: string;
  revisionNo: number;
  snapshot: ReportSnapshotData;
  createdBy: string;
  issuedBy: string;
}

export interface CaseMutation<T> {
  next: CaseRecord;
  result: T;
}

export interface DeletedCase {
  revisionCount: number;
  storagePaths: string[];
}

export type CaseMutator<T> = (current: CaseRecord) => CaseMutation<T>;

export interface CaseStore {
  create(record: CaseRecord): Promise<CaseRecord>;
  list(user: AuthenticatedUser): Promise<CaseRecord[]>;
  get(caseGroupId: string, user: AuthenticatedUser): Promise<CaseRecord>;
  mutate<T>(
    caseGroupId: string,
    user: AuthenticatedUser,
    mutator: CaseMutator<T>,
  ): Promise<T>;
  delete(caseGroupId: string, user: AuthenticatedUser): Promise<DeletedCase>;
  commitIssuedReport(
    caseGroupId: string,
    expectedVersion: number,
    report: ReportRecord,
    user: AuthenticatedUser,
  ): Promise<ReportRecord>;
  getReport(reportId: string, user: AuthenticatedUser): Promise<ReportRecord>;
  healthcheck(): Promise<void>;
}

export function canReadCase(record: CaseRecord, user: AuthenticatedUser) {
  void record;
  return user.roles.some((role) =>
    ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"].includes(role),
  );
}
