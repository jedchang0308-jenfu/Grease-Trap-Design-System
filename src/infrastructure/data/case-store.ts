import { z } from "zod";
import type { TrackStatus } from "@/domain/calculation/orchestration";
import type { ReportSnapshotData, SnapshotRun } from "@/domain/report/types";

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

export interface ReportDraft {
  id: string;
  reportNumber: string;
  snapshotHash: string;
  status: "DRAFT_EXPORTED" | "LEGACY_ISSUED";
  snapshot: ReportSnapshotData;
  createdBy: string;
  exportedAt: string;
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
  created_at: string;
  updated_at: string;
  calculations: PersistedCalculation[];
  assessments: PersistedAssessment[];
  overrides: PersistedOverride[];
  report_draft: ReportDraft | null;
}

export interface CaseMutation<T> {
  next: CaseRecord;
  result: T;
}

export type CaseMutator<T> = (current: CaseRecord) => CaseMutation<T>;

export interface CaseStore {
  create(record: CaseRecord): Promise<CaseRecord>;
  list(): Promise<CaseRecord[]>;
  get(caseGroupId: string): Promise<CaseRecord>;
  mutate<T>(caseGroupId: string, mutator: CaseMutator<T>): Promise<T>;
  archiveCurrentAndMutate<T>(
    caseGroupId: string,
    expectedVersion: number,
    mutator: CaseMutator<T>,
  ): Promise<T>;
  listRevisions(caseGroupId: string): Promise<CaseRecord[]>;
  getRevision(caseGroupId: string, revisionNo: number): Promise<CaseRecord>;
  beginDelete(
    caseGroupId: string,
    expectedVersion: number,
  ): Promise<CaseRecord>;
  purgeRevisions(caseGroupId: string): Promise<number>;
  finishDelete(caseGroupId: string): Promise<void>;
  delete(caseGroupId: string): Promise<void>;
}

const nullableShortString = z.string().max(160).nullable();

export const caseDocumentSchema = z
  .object({
    schemaVersion: z.literal("3.0"),
    id: z.string().uuid(),
    caseGroupId: z.string().uuid(),
    caseNo: z.string().min(1).max(40),
    revisionNo: z.number().int().min(1).max(10_000),
    customer: z.string().max(160),
    location: z.string().max(240),
    title: z.string().max(160),
    purpose: z.string().max(500),
    diningType: nullableShortString,
    taskCode: z.string().min(1).max(64),
    mode: z.string().min(1).max(32),
    lifecycleStatus: z.string().min(1).max(32),
    calculationStatus: z.string().max(32).nullable(),
    version: z.number().int().min(1).max(1_000_000),
    createdBy: z.string().min(1).max(128),
    createdByName: z.string().min(1).max(160),
    preparedBy: z.string().max(128).nullable(),
    preparedByName: z.string().max(160).nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    inputPayloadJson: z.string().max(60_000),
    calculationsJson: z.string().max(320_000),
    assessmentsJson: z.string().max(60_000),
    overridesJson: z.string().max(60_000),
    reportDraftJson: z.string().max(360_000),
  })
  .strict();

export type CaseDocument = z.infer<typeof caseDocumentSchema>;

function parseJson<T>(value: string, fallback: T): T {
  if (!value) return fallback;
  return JSON.parse(value) as T;
}

export function encodeCase(record: CaseRecord): CaseDocument {
  return caseDocumentSchema.parse({
    schemaVersion: "3.0",
    id: record.id,
    caseGroupId: record.case_group_id,
    caseNo: record.case_no,
    revisionNo: record.revision_no,
    customer: record.customer,
    location: record.location,
    title: record.title,
    purpose: record.purpose,
    diningType: record.dining_type,
    taskCode: record.task_code,
    mode: record.mode,
    lifecycleStatus: record.lifecycle_status,
    calculationStatus: record.calculation_status,
    version: record.version,
    createdBy: record.created_by,
    createdByName: record.created_by_name,
    preparedBy: record.prepared_by,
    preparedByName: record.prepared_by_name,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
    inputPayloadJson: JSON.stringify(record.input_payload),
    calculationsJson: JSON.stringify(record.calculations),
    assessmentsJson: JSON.stringify(record.assessments),
    overridesJson: JSON.stringify(record.overrides),
    reportDraftJson: record.report_draft
      ? JSON.stringify(record.report_draft)
      : "",
  });
}

export function decodeCase(value: unknown): CaseRecord {
  const document = caseDocumentSchema.parse(value);
  return {
    id: document.id,
    case_group_id: document.caseGroupId,
    case_no: document.caseNo,
    revision_no: document.revisionNo,
    customer: document.customer,
    location: document.location,
    title: document.title,
    purpose: document.purpose,
    dining_type: document.diningType,
    task_code: document.taskCode,
    mode: document.mode,
    lifecycle_status: document.lifecycleStatus,
    calculation_status: document.calculationStatus,
    input_payload: parseJson(document.inputPayloadJson, {}),
    version: document.version,
    created_by: document.createdBy,
    created_by_name: document.createdByName,
    prepared_by: document.preparedBy,
    prepared_by_name: document.preparedByName,
    created_at: document.createdAt,
    updated_at: document.updatedAt,
    calculations: parseJson(document.calculationsJson, []),
    assessments: parseJson(document.assessmentsJson, []),
    overrides: parseJson(document.overridesJson, []),
    report_draft: parseJson(document.reportDraftJson, null),
  };
}
