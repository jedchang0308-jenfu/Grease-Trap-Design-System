import { randomUUID } from "node:crypto";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { caseStore } from "@/infrastructure/data";
import { reportStorage } from "@/infrastructure/storage/report-storage";
import type {
  CaseMutator,
  CaseRecord,
  ReportRecord,
} from "@/infrastructure/data/case-store";

export type CaseRow = CaseRecord;

function makeCaseNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `GTC-${date}-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function createCase(
  input: {
    customer: string;
    location: string;
    title: string;
    purpose: string;
    taskCode: string;
    mode: string;
  },
  user: AuthenticatedUser,
) {
  const now = new Date().toISOString();
  const caseGroupId = randomUUID();
  const record: CaseRecord = {
    id: randomUUID(),
    case_group_id: caseGroupId,
    case_no: makeCaseNumber(),
    revision_no: 1,
    customer: input.customer,
    location: input.location,
    title: input.title,
    purpose: input.purpose,
    dining_type: null,
    task_code: input.taskCode,
    mode: input.mode,
    lifecycle_status: "DRAFT",
    calculation_status: null,
    input_payload: {},
    version: 1,
    created_by: user.id,
    created_by_name: user.displayName,
    prepared_by: null,
    prepared_by_name: null,
    reviewed_by: null,
    reviewed_by_name: null,
    issued_by: null,
    issued_by_name: null,
    created_at: now,
    updated_at: now,
    calculations: [],
    assessments: [],
    overrides: [],
    review: null,
    reports: [],
    latestReportId: null,
    calculationRequests: {},
  };
  return caseStore.create(record);
}

export async function listCases(
  user: AuthenticatedUser,
  filters: { search: string; mode: string; status: string },
) {
  const search = filters.search.toLocaleLowerCase("zh-Hant");
  return (await caseStore.list(user))
    .filter((record) => {
      const matchesSearch =
        !search ||
        [record.customer, record.case_no, record.title].some((value) =>
          value.toLocaleLowerCase("zh-Hant").includes(search),
        );
      const matchesMode = !filters.mode || record.mode === filters.mode;
      const matchesStatus =
        !filters.status ||
        record.lifecycle_status === filters.status ||
        record.calculation_status === filters.status;
      return matchesSearch && matchesMode && matchesStatus;
    })
    .sort((left, right) => right.updated_at.localeCompare(left.updated_at));
}

export async function getLatestCase(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  return caseStore.get(caseGroupId, user);
}

export async function mutateCase<T>(
  caseGroupId: string,
  user: AuthenticatedUser,
  mutator: CaseMutator<T>,
) {
  return caseStore.mutate(caseGroupId, user, mutator);
}

export async function deleteCaseGroup(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const deleted = await caseStore.delete(caseGroupId, user);
  await Promise.allSettled(
    deleted.storagePaths.map((storagePath) =>
      reportStorage.delete(storagePath),
    ),
  );
  return { caseId: caseGroupId, deletedRevisionCount: deleted.revisionCount };
}

export async function commitIssuedReport(
  caseGroupId: string,
  expectedVersion: number,
  report: ReportRecord,
  user: AuthenticatedUser,
) {
  return caseStore.commitIssuedReport(
    caseGroupId,
    expectedVersion,
    report,
    user,
  );
}

export async function getReport(reportId: string, user: AuthenticatedUser) {
  return caseStore.getReport(reportId, user);
}

export async function dataHealthcheck() {
  return caseStore.healthcheck();
}

export function presentCase(record: CaseRecord) {
  const item = structuredClone(record) as unknown as Record<string, unknown>;
  delete item.calculationRequests;
  delete item.review;
  return { ...item, caseId: record.case_group_id };
}
