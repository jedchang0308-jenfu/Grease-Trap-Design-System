import { AppProblem } from "@/application/problem";
import { firebaseAuth } from "@/infrastructure/firebase/client";
import { caseStore } from "@/infrastructure/data";
import type { CaseMutator, CaseRecord } from "@/infrastructure/data/case-store";

export interface BrowserActor {
  id: string;
  displayName: string;
}

export function currentActor(): BrowserActor {
  const user = firebaseAuth.currentUser;
  if (!user) {
    throw new AppProblem({
      code: "AUTH_REQUIRED",
      title: "匿名連線尚未完成",
      userMessage: "請等待匿名連線完成後再操作。",
      retryable: true,
    });
  }
  return {
    id: user.uid,
    displayName: `訪客 ${user.uid.slice(0, 8)}`,
  };
}

function makeCaseNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `GTC-${date}-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function createCase(input: {
  customer: string;
  location: string;
  title: string;
  purpose: string;
  taskCode: string;
  mode: string;
}) {
  const actor = currentActor();
  const now = new Date().toISOString();
  const caseGroupId = crypto.randomUUID();
  const record: CaseRecord = {
    id: crypto.randomUUID(),
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
    created_by: actor.id,
    created_by_name: actor.displayName,
    prepared_by: null,
    prepared_by_name: null,
    created_at: now,
    updated_at: now,
    calculations: [],
    assessments: [],
    overrides: [],
    report_draft: null,
  };
  return caseStore.create(record);
}

export async function listCases(filters: {
  search: string;
  mode: string;
  status: string;
}) {
  const search = filters.search.toLocaleLowerCase("zh-Hant");
  return (await caseStore.list()).filter((record) => {
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
  });
}

export function getLatestCase(caseGroupId: string) {
  return caseStore.get(caseGroupId);
}

export function mutateCase<T>(caseGroupId: string, mutator: CaseMutator<T>) {
  return caseStore.mutate(caseGroupId, mutator);
}

export async function deleteCaseGroup(caseGroupId: string) {
  await caseStore.delete(caseGroupId);
  return { caseId: caseGroupId };
}

export function presentCase(record: CaseRecord) {
  const reports = record.report_draft
    ? [
        {
          id: record.report_draft.id,
          status: record.report_draft.status,
          reportNumber: record.report_draft.reportNumber,
        },
      ]
    : [];
  return {
    ...structuredClone(record),
    caseId: record.case_group_id,
    reports,
  };
}
