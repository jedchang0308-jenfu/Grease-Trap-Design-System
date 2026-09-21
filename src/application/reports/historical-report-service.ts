import { AppProblem } from "@/application/problem";
import { getHistoricalCase } from "@/application/cases/history-service";
import { reportPreviewFromSnapshot } from "@/application/reports/report-service";
import { REPORT_NUMBER_PLACEHOLDER } from "@/domain/report/types";

export function historicalReportFileName(caseNo: string, revisionNo: number) {
  const revision = String(revisionNo).padStart(2, "0");
  return `${caseNo}-R${revision}-REGENERATED.pdf`;
}

function missingSnapshotProblem() {
  return new AppProblem({
    code: "HISTORICAL_REPORT_NOT_AVAILABLE",
    title: "歷史版本沒有報告快照",
    userMessage: "此歷史版本未保存報告快照，無法重新產生報告。",
    retryable: false,
  });
}

export async function previewHistoricalReport(
  caseGroupId: string,
  revisionNo: number,
) {
  const { revision } = await getHistoricalCase(caseGroupId, revisionNo);
  const snapshot = revision.report_draft?.snapshot;
  if (!snapshot) throw missingSnapshotProblem();
  return reportPreviewFromSnapshot(
    { ...snapshot, reportNumber: REPORT_NUMBER_PLACEHOLDER },
    {
      version: revision.version,
      exported: true,
      legacyIssued: revision.lifecycle_status === "ISSUED",
      sourceRevisionNo: revision.revision_no,
    },
    { historical: true },
  );
}
