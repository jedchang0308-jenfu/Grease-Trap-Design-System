import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import {
  canReadCase,
  type CaseMutator,
  type CaseRecord,
  type CaseStore,
  type DeletedCase,
  type ReportRecord,
  type ReportSummary,
} from "./case-store";

interface LocalFileDocument {
  schemaVersion: 1;
  savedAt: string;
  cases: CaseRecord[];
  reports: ReportRecord[];
}

interface LocalFileState {
  cases: Map<string, CaseRecord>;
  reports: Map<string, ReportRecord>;
}

const issueableLifecycleStatuses = new Set([
  "CALCULATED",
  "IN_REVIEW",
  "REVIEWED",
]);

function copy<T>(value: T): T {
  return structuredClone(value);
}

function emptyState(): LocalFileState {
  return { cases: new Map(), reports: new Map() };
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

function reportNotFound() {
  return new AppProblem({
    code: "REPORT_NOT_FOUND",
    title: "找不到報告",
    userMessage: "找不到可下載的已核發報告，請返回案件查看紀錄。",
    status: 404,
  });
}

function localDataCorrupt() {
  return new AppProblem({
    code: "LOCAL_DATA_CORRUPT",
    title: "本機資料檔無法讀取",
    userMessage:
      "本機案件資料檔格式不正確，請先處理 output/local-data/case-store.json 後再重新啟動。",
    status: 500,
  });
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && "code" in error;
}

function readCase(
  state: LocalFileState,
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const record = state.cases.get(caseGroupId);
  if (!record) throw notFound();
  if (!canReadCase(record, user)) throw accessDenied();
  return record;
}

export class LocalFileCaseStore implements CaseStore {
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly filePath: string) {
    this.filePath = path.resolve(filePath);
  }

  async create(record: CaseRecord) {
    return this.exclusive(async () => {
      const state = await this.load();
      if (state.cases.has(record.case_group_id)) {
        throw new Error(`Case ${record.case_group_id} already exists`);
      }
      state.cases.set(record.case_group_id, copy(record));
      await this.save(state);
      return copy(record);
    });
  }

  async list(user: AuthenticatedUser) {
    return this.exclusive(async () => {
      const state = await this.load();
      return [...state.cases.values()]
        .filter((record) => canReadCase(record, user))
        .map(copy);
    });
  }

  async get(caseGroupId: string, user: AuthenticatedUser) {
    return this.exclusive(async () => {
      const state = await this.load();
      return copy(readCase(state, caseGroupId, user));
    });
  }

  async mutate<T>(
    caseGroupId: string,
    user: AuthenticatedUser,
    mutator: CaseMutator<T>,
  ) {
    return this.exclusive(async () => {
      const state = await this.load();
      const mutation = mutator(copy(readCase(state, caseGroupId, user)));
      state.cases.set(caseGroupId, copy(mutation.next));
      await this.save(state);
      return copy(mutation.result);
    });
  }

  async delete(caseGroupId: string, user: AuthenticatedUser) {
    return this.exclusive(async (): Promise<DeletedCase> => {
      const state = await this.load();
      const record = readCase(state, caseGroupId, user);
      const storagePaths: string[] = [];
      state.cases.delete(caseGroupId);
      for (const [reportId, report] of state.reports) {
        if (report.caseGroupId === caseGroupId) {
          storagePaths.push(report.storagePath);
          state.reports.delete(reportId);
        }
      }
      await this.save(state);
      return { revisionCount: record.revision_no, storagePaths };
    });
  }

  async commitIssuedReport(
    caseGroupId: string,
    expectedVersion: number,
    report: ReportRecord,
    user: AuthenticatedUser,
  ) {
    return this.exclusive(async () => {
      const state = await this.load();
      const record = readCase(state, caseGroupId, user);
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
      const next: CaseRecord = {
        ...record,
        lifecycle_status: "ISSUED",
        issued_by: user.id,
        issued_by_name: user.displayName,
        version: record.version + 1,
        updated_at: report.issuedAt,
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
      await this.save(state);
      return copy(report);
    });
  }

  async getReport(reportId: string, user: AuthenticatedUser) {
    return this.exclusive(async () => {
      const state = await this.load();
      const report = state.reports.get(reportId);
      if (!report) throw reportNotFound();
      readCase(state, report.caseGroupId, user);
      return copy(report);
    });
  }

  async healthcheck() {
    await this.exclusive(async () => {
      await mkdir(path.dirname(this.filePath), { recursive: true });
      await this.load();
    });
  }

  private async exclusive<T>(operation: () => Promise<T>) {
    const run = this.queue.then(
      () => operation(),
      () => operation(),
    );
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<LocalFileState> {
    let raw: string;
    try {
      raw = await readFile(this.filePath, "utf8");
    } catch (error) {
      if (isNodeError(error) && error.code === "ENOENT") return emptyState();
      throw error;
    }

    try {
      const document = JSON.parse(raw) as Partial<LocalFileDocument>;
      const cases = Array.isArray(document.cases) ? document.cases : [];
      const reports = Array.isArray(document.reports) ? document.reports : [];
      return {
        cases: new Map(
          cases.map((record) => [record.case_group_id, copy(record)]),
        ),
        reports: new Map(reports.map((report) => [report.id, copy(report)])),
      };
    } catch (error) {
      if (error instanceof SyntaxError) throw localDataCorrupt();
      throw error;
    }
  }

  private async save(state: LocalFileState) {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    const document: LocalFileDocument = {
      schemaVersion: 1,
      savedAt: new Date().toISOString(),
      cases: [...state.cases.values()].map(copy),
      reports: [...state.reports.values()].map(copy),
    };
    const temporaryPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`);
    await rename(temporaryPath, this.filePath);
  }
}
