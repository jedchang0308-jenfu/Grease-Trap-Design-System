import { AppProblem } from "@/application/problem";
import { caseStore } from "@/infrastructure/data";

export async function createRevision(
  caseGroupId: string,
  expectedVersion: number,
) {
  return caseStore.archiveCurrentAndMutate(
    caseGroupId,
    expectedVersion,
    (row) => {
      if (row.version !== expectedVersion) {
        throw new AppProblem({
          code: "STALE_CASE_VERSION",
          title: "共享案件已有新版本",
          userMessage: "請重新載入後再建立版本。",
          retryable: true,
        });
      }
      if (!row.report_draft || row.lifecycle_status !== "REPORT_DRAFT") {
        throw new AppProblem({
          code: "REVISION_REQUIRES_REPORT_DRAFT",
          title: "目前不需建立版本",
          userMessage:
            "只有已匯出報告草稿可建立新版本；舊系統歷史資料僅供唯讀查看。",
          retryable: false,
        });
      }
      const now = new Date().toISOString();
      const revisionNo = row.revision_no + 1;
      return {
        next: {
          ...row,
          id: crypto.randomUUID(),
          revision_no: revisionNo,
          lifecycle_status: "DRAFT",
          calculation_status: null,
          input_payload: {},
          version: row.version + 1,
          prepared_by: null,
          prepared_by_name: null,
          updated_at: now,
          calculations: [],
          assessments: [],
          overrides: [],
          report_draft: null,
        },
        result: {
          caseId: caseGroupId,
          revisionNo,
          caseVersion: row.version + 1,
        },
      };
    },
  );
}
