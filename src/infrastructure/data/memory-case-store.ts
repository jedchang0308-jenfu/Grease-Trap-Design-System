import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import {
  canReadCase,
  type CaseMutator,
  type CaseRecord,
  type CaseStore,
  type ReportSummary,
  type ReportRecord,
} from "./case-store";

interface MemoryState {
  cases: Map<string, CaseRecord>;
  reports: Map<string, ReportRecord>;
}

declare global {
  var __gtcMemoryState: MemoryState | undefined;
}

const state =
  globalThis.__gtcMemoryState ??
  ({ cases: new Map(), reports: new Map() } satisfies MemoryState);

globalThis.__gtcMemoryState = state;

const issueableLifecycleStatuses = new Set([
  "CALCULATED",
  "IN_REVIEW",
  "REVIEWED",
]);

function copy<T>(value: T): T {
  return structuredClone(value);
}

function notFound() {
  return new AppProblem({
    code: "CASE_NOT_FOUND",
    title: "找不到案件",
    userMessage: "找不到這筆案件，請返回案件清單。",
    status: 404,
  });
}

function accessDenied() {
  return new AppProblem({
    code: "CASE_ACCESS_DENIED",
    title: "無權存取",
    userMessage: "你沒有這筆案件的存取權限，請返回安全頁面。",
    status: 403,
  });
}

function readCase(caseGroupId: string, user: AuthenticatedUser) {
  const record = state.cases.get(caseGroupId);
  if (!record) throw notFound();
  if (!canReadCase(record, user)) throw accessDenied();
  return record;
}

export class MemoryCaseStore implements CaseStore {
  async create(record: CaseRecord) {
    if (state.cases.has(record.case_group_id)) {
      throw new Error(`Case ${record.case_group_id} already exists`);
    }
    state.cases.set(record.case_group_id, copy(record));
    return copy(record);
  }

  async list(user: AuthenticatedUser) {
    return [...state.cases.values()]
      .filter((record) => canReadCase(record, user))
      .map(copy);
  }

  async get(caseGroupId: string, user: AuthenticatedUser) {
    return copy(readCase(caseGroupId, user));
  }

  async mutate<T>(
    caseGroupId: string,
    user: AuthenticatedUser,
    mutator: CaseMutator<T>,
  ) {
    const mutation = mutator(copy(readCase(caseGroupId, user)));
    state.cases.set(caseGroupId, copy(mutation.next));
    return copy(mutation.result);
  }

  async delete(caseGroupId: string, user: AuthenticatedUser) {
    const record = readCase(caseGroupId, user);
    const storagePaths: string[] = [];
    state.cases.delete(caseGroupId);
    for (const [reportId, report] of state.reports) {
      if (report.caseGroupId === caseGroupId) {
        storagePaths.push(report.storagePath);
        state.reports.delete(reportId);
      }
    }
    return { revisionCount: record.revision_no, storagePaths };
  }

  async commitIssuedReport(
    caseGroupId: string,
    expectedVersion: number,
    report: ReportRecord,
    user: AuthenticatedUser,
  ) {
    const record = readCase(caseGroupId, user);
    if (record.lifecycle_status === "ISSUED" && record.latestReportId) {
      const existing = state.reports.get(record.latestReportId);
      if (existing) return copy(existing);
    }
    if (
      record.version !== expectedVersion ||
      !issueableLifecycleStatuses.has(record.lifecycle_status)
    ) {
      throw new AppProblem({
        code: "ISSUE_STATE_CHANGED",
        title: "案件狀態已變更",
        userMessage: "案件在產生報告期間已更新，請重新載入後再核發。",
        status: 409,
        retryable: true,
      });
    }
    const now = report.issuedAt;
    const next: CaseRecord = {
      ...record,
      lifecycle_status: "ISSUED",
      issued_by: user.id,
      issued_by_name: user.displayName,
      version: record.version + 1,
      updated_at: now,
      latestReportId: report.id,
      reports: [
        report,
        ...record.reports.filter(
          (item: ReportSummary) => item.id !== report.id,
        ),
      ],
    };
    state.reports.set(report.id, copy(report));
    state.cases.set(caseGroupId, copy(next));
    return copy(report);
  }

  async getReport(reportId: string, user: AuthenticatedUser) {
    const report = state.reports.get(reportId);
    if (!report) {
      throw new AppProblem({
        code: "REPORT_NOT_FOUND",
        title: "找不到報告",
        userMessage: "找不到可下載的已核發報告，請返回案件查看紀錄。",
        status: 404,
      });
    }
    readCase(report.caseGroupId, user);
    return copy(report);
  }

  async healthcheck() {}
}

export function resetMemoryCaseStore() {
  state.cases.clear();
  state.reports.clear();
}
