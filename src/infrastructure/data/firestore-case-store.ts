import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { firestore } from "@/infrastructure/firebase/admin";
import {
  canReadCase,
  type CaseMutator,
  type CaseRecord,
  type CaseStore,
  type ReportRecord,
} from "./case-store";

function caseRef(caseGroupId: string) {
  return firestore.collection("cases").doc(caseGroupId);
}

function reportRef(reportId: string) {
  return firestore.collection("reports").doc(reportId);
}

const issueableLifecycleStatuses = new Set([
  "CALCULATED",
  "IN_REVIEW",
  "REVIEWED",
]);

function notFound() {
  return new AppProblem({
    code: "CASE_NOT_FOUND",
    title: "找不到案件",
    userMessage: "找不到這筆案件，請返回案件清單。",
    status: 404,
  });
}

function assertAccess(record: CaseRecord, user: AuthenticatedUser) {
  if (!canReadCase(record, user)) {
    throw new AppProblem({
      code: "CASE_ACCESS_DENIED",
      title: "無權存取",
      userMessage: "你沒有這筆案件的存取權限，請返回安全頁面。",
      status: 403,
    });
  }
}

export class FirestoreCaseStore implements CaseStore {
  async create(record: CaseRecord) {
    await caseRef(record.case_group_id).create(record);
    return structuredClone(record);
  }

  async list(user: AuthenticatedUser) {
    const snapshot = await firestore.collection("cases").get();
    return snapshot.docs
      .map((document) => document.data() as CaseRecord)
      .filter((record) => canReadCase(record, user));
  }

  async get(caseGroupId: string, user: AuthenticatedUser) {
    const snapshot = await caseRef(caseGroupId).get();
    if (!snapshot.exists) throw notFound();
    const record = snapshot.data() as CaseRecord;
    assertAccess(record, user);
    return record;
  }

  async mutate<T>(
    caseGroupId: string,
    user: AuthenticatedUser,
    mutator: CaseMutator<T>,
  ) {
    return firestore.runTransaction(async (transaction) => {
      const reference = caseRef(caseGroupId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw notFound();
      const current = snapshot.data() as CaseRecord;
      assertAccess(current, user);
      const mutation = mutator(current);
      transaction.set(reference, mutation.next);
      return mutation.result;
    });
  }

  async delete(caseGroupId: string, user: AuthenticatedUser) {
    const record = await this.get(caseGroupId, user);
    const reports = await firestore
      .collection("reports")
      .where("caseGroupId", "==", caseGroupId)
      .get();
    const batch = firestore.batch();
    batch.delete(caseRef(caseGroupId));
    for (const report of reports.docs) batch.delete(report.ref);
    await batch.commit();
    return {
      revisionCount: record.revision_no,
      storagePaths: reports.docs.map(
        (document) => (document.data() as ReportRecord).storagePath,
      ),
    };
  }

  async commitIssuedReport(
    caseGroupId: string,
    expectedVersion: number,
    report: ReportRecord,
    user: AuthenticatedUser,
  ) {
    return firestore.runTransaction(async (transaction) => {
      const reference = caseRef(caseGroupId);
      const snapshot = await transaction.get(reference);
      if (!snapshot.exists) throw notFound();
      const current = snapshot.data() as CaseRecord;
      assertAccess(current, user);
      if (current.lifecycle_status === "ISSUED" && current.latestReportId) {
        const existing = await transaction.get(
          reportRef(current.latestReportId),
        );
        if (existing.exists) return existing.data() as ReportRecord;
      }
      if (
        current.version !== expectedVersion ||
        !issueableLifecycleStatuses.has(current.lifecycle_status)
      ) {
        throw new AppProblem({
          code: "ISSUE_STATE_CHANGED",
          title: "案件狀態已變更",
          userMessage: "案件在產生報告期間已更新，請重新載入後再核發。",
          status: 409,
          retryable: true,
        });
      }
      transaction.create(reportRef(report.id), report);
      transaction.set(reference, {
        ...current,
        lifecycle_status: "ISSUED",
        issued_by: user.id,
        issued_by_name: user.displayName,
        version: current.version + 1,
        updated_at: report.issuedAt,
        latestReportId: report.id,
        reports: [
          report,
          ...current.reports.filter((item) => item.id !== report.id),
        ],
      } satisfies CaseRecord);
      return report;
    });
  }

  async getReport(reportId: string, user: AuthenticatedUser) {
    const snapshot = await reportRef(reportId).get();
    if (!snapshot.exists) {
      throw new AppProblem({
        code: "REPORT_NOT_FOUND",
        title: "找不到報告",
        userMessage: "找不到可下載的已核發報告，請返回案件查看紀錄。",
        status: 404,
      });
    }
    const report = snapshot.data() as ReportRecord;
    await this.get(report.caseGroupId, user);
    return report;
  }

  async healthcheck() {
    await firestore.collection("system").doc("health").get();
  }
}
