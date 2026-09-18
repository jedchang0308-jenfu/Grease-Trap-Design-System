import { AppProblem } from "@/application/problem";
import { firebaseAuth } from "@/infrastructure/firebase/client";
import { caseStore } from "@/infrastructure/data";
import {
  type CaseMutator,
  type CaseRecord,
} from "@/infrastructure/data/case-store";
import { REPORT_NUMBER_PLACEHOLDER } from "@/domain/report/types";

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

function caseNumberDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "2-digit",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts
      .filter(({ type }) => type !== "literal")
      .map(({ type, value }) => [type, value]),
  );
  return `${values.year}${values.month}${values.day}`;
}

const activeCaseLifecycles = new Set([
  "DRAFT",
  "INPUT_READY",
  "CALCULATED",
  "REPORT_DRAFT",
]);

function caseNumberSequence(caseNo: string, date: string) {
  const match = caseNo.match(new RegExp(`^GTC-${date}-(\\d{2})$`));
  if (!match) return null;
  const sequence = Number(match[1]);
  return sequence >= 1 && sequence <= 99 ? sequence : null;
}

function firstAvailableSequence(usedSequences: Set<number>) {
  return Array.from({ length: 99 }, (_, index) => index + 1).find(
    (value) => !usedSequences.has(value),
  );
}

async function migrateExistingCaseNumbers() {
  const records = await caseStore.list();
  const recordsByDate = new Map<string, CaseRecord[]>();

  for (const record of records) {
    const date = caseNumberDate(new Date(record.created_at));
    const dateRecords = recordsByDate.get(date) ?? [];
    dateRecords.push(record);
    recordsByDate.set(date, dateRecords);
  }

  const migrationPlans = new Map<string, string>();
  for (const [date, dateRecords] of recordsByDate) {
    const orderedRecords = [...dateRecords].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );
    const usedSequences = new Set<number>();

    for (const record of orderedRecords) {
      const sequence = caseNumberSequence(record.case_no, date);
      if (sequence !== null && !usedSequences.has(sequence)) {
        usedSequences.add(sequence);
        migrationPlans.set(record.case_group_id, record.case_no);
      }
    }

    for (const record of orderedRecords) {
      if (
        migrationPlans.has(record.case_group_id) ||
        !activeCaseLifecycles.has(record.lifecycle_status)
      ) {
        continue;
      }
      const sequence = firstAvailableSequence(usedSequences);
      if (sequence === undefined) {
        throw new AppProblem({
          code: "CASE_NUMBER_EXHAUSTED",
          title: "今日案件編號已用完",
          userMessage: "今日案件編號已達 99 筆，請隔日再建立案件。",
          retryable: false,
        });
      }
      usedSequences.add(sequence);
      migrationPlans.set(
        record.case_group_id,
        `GTC-${date}-${String(sequence).padStart(2, "0")}`,
      );
    }
  }

  for (const record of records) {
    const nextCaseNumber = migrationPlans.get(record.case_group_id);
    if (
      nextCaseNumber === undefined ||
      nextCaseNumber === record.case_no ||
      !activeCaseLifecycles.has(record.lifecycle_status)
    ) {
      continue;
    }

    await caseStore.mutate(record.case_group_id, (current) => ({
      next: {
        ...current,
        case_no: nextCaseNumber,
        version: current.version + 1,
        updated_at: new Date().toISOString(),
      },
      result: undefined,
    }));
  }
}

let caseNumberMigrationPromise: Promise<void> | null = null;

function ensureCaseNumberMigration() {
  caseNumberMigrationPromise ??= migrateExistingCaseNumbers().finally(() => {
    caseNumberMigrationPromise = null;
  });
  return caseNumberMigrationPromise;
}

async function makeCaseNumber() {
  const date = caseNumberDate();
  const prefix = `GTC-${date}-`;
  const usedSequences = new Set(
    (await caseStore.list())
      .map((record) => record.case_no.match(new RegExp(`^${prefix}(\\d{2})$`)))
      .filter((match): match is RegExpMatchArray => match !== null)
      .map((match) => Number(match[1])),
  );
  const sequence = Array.from({ length: 99 }, (_, index) => index + 1).find(
    (value) => !usedSequences.has(value),
  );
  if (sequence === undefined) {
    throw new AppProblem({
      code: "CASE_NUMBER_EXHAUSTED",
      title: "今日案件編號已用完",
      userMessage: "今日案件編號已達 99 筆，請隔日再建立案件。",
      retryable: false,
    });
  }
  return `${prefix}${String(sequence).padStart(2, "0")}`;
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
  await ensureCaseNumberMigration();
  const now = new Date().toISOString();
  const caseGroupId = crypto.randomUUID();
  const record: CaseRecord = {
    id: crypto.randomUUID(),
    case_group_id: caseGroupId,
    case_no: await makeCaseNumber(),
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
  await ensureCaseNumberMigration();
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

export async function getLatestCase(caseGroupId: string) {
  await ensureCaseNumberMigration();
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
          reportNumber: REPORT_NUMBER_PLACEHOLDER,
        },
      ]
    : [];
  return {
    ...structuredClone(record),
    caseId: record.case_group_id,
    reports,
  };
}
