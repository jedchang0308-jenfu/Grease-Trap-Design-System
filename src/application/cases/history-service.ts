import { AppProblem } from "@/application/problem";
import { caseStore } from "@/infrastructure/data";
import type { CaseRecord } from "@/infrastructure/data/case-store";

export interface CaseHistoryList {
  current: CaseRecord;
  revisions: CaseRecord[];
  missingRevisionNos: number[];
  deleting: boolean;
}

function deletingProblem() {
  return new AppProblem({
    code: "CASE_DELETE_IN_PROGRESS",
    title: "案件刪除尚未完成",
    userMessage: "案件正在刪除中，歷史內容暫不顯示，請繼續刪除。",
    retryable: true,
  });
}

export function calculateMissingRevisionNos(
  current: CaseRecord,
  revisions: CaseRecord[],
) {
  if (current.revision_no <= 1) return [];
  const present = new Set(revisions.map((record) => record.revision_no));
  return Array.from(
    { length: current.revision_no - 1 },
    (_, index) => index + 1,
  ).filter((revisionNo) => !present.has(revisionNo));
}

export async function listCaseHistory(
  caseGroupId: string,
): Promise<CaseHistoryList> {
  const current = await caseStore.get(caseGroupId);
  if (current.lifecycle_status === "DELETING") {
    return {
      current,
      revisions: [],
      missingRevisionNos: [],
      deleting: true,
    };
  }
  const revisions = await caseStore.listRevisions(caseGroupId);
  return {
    current,
    revisions,
    missingRevisionNos: calculateMissingRevisionNos(current, revisions),
    deleting: false,
  };
}

export async function getHistoricalCase(
  caseGroupId: string,
  revisionNo: number,
) {
  const current = await caseStore.get(caseGroupId);
  if (current.lifecycle_status === "DELETING") throw deletingProblem();
  const revision = await caseStore.getRevision(caseGroupId, revisionNo);
  if (
    revision.case_group_id !== caseGroupId ||
    revision.revision_no !== revisionNo
  ) {
    throw new AppProblem({
      code: "REVISION_DATA_CONFLICT",
      title: "歷史版本資料衝突",
      userMessage: "歷史版本資料與案件不一致，請通知管理者檢查資料。",
      retryable: false,
    });
  }
  return { current, revision };
}

export function historicalHasReportSnapshot(record: CaseRecord) {
  return Boolean(record.report_draft?.snapshot);
}
