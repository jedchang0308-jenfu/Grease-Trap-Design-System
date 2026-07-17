import { AppProblem } from "@/application/problem";
import {
  currentActor,
  getLatestCase,
  mutateCase,
} from "@/application/cases/repository";
import { renderReportHtml } from "@/domain/report/html";
import type { ReportSnapshotData, SnapshotRun } from "@/domain/report/types";
import { sha256 } from "@/domain/shared/canonical";
import type { CaseRecord } from "@/infrastructure/data/case-store";

const previewableLifecycleStatuses = new Set([
  "CALCULATED",
  "REPORT_DRAFT",
  "IN_REVIEW",
  "REVIEWED",
  "ISSUED",
]);
const reportableCalculationStatuses = new Set([
  "COMPLETE",
  "COMPLETE_WITH_REMINDER",
]);

function draftNumber(item: CaseRecord) {
  return `DRAFT-${item.case_no}-R${item.revision_no}`;
}

export async function previewReport(caseGroupId: string) {
  const item = await getLatestCase(caseGroupId);
  if (
    !previewableLifecycleStatuses.has(item.lifecycle_status) ||
    !reportableCalculationStatuses.has(item.calculation_status ?? "")
  ) {
    throw new AppProblem({
      code: "REPORT_REQUIRES_CALCULATION",
      title: "報告草稿尚未可預覽",
      userMessage: "請先完成至少一軌有效計算，再建立報告草稿。",
      retryable: false,
    });
  }
  const snapshot =
    item.report_draft?.snapshot ??
    buildSnapshot(item, draftNumber(item), "尚未匯出");
  return {
    version: item.version,
    reportNumber: snapshot.reportNumber,
    snapshotHash: sha256(snapshot),
    case: snapshot.case,
    assessments: snapshot.assessments,
    html: renderReportHtml(snapshot),
    exported: Boolean(item.report_draft),
    legacyIssued: item.lifecycle_status === "ISSUED",
  };
}

export async function exportReportDraft(
  caseGroupId: string,
  expectedVersion: number,
) {
  const actor = currentActor();
  return mutateCase(caseGroupId, (item) => {
    if (item.lifecycle_status === "ISSUED") {
      throw new AppProblem({
        code: "LEGACY_ISSUED_READ_ONLY",
        title: "舊系統歷史資料僅供查閱",
        userMessage: "靜態版不會重新建立或覆寫舊系統歷史紀錄。",
        retryable: false,
      });
    }
    if (item.version !== expectedVersion) {
      throw new AppProblem({
        code: "STALE_CASE_VERSION",
        title: "共享案件已有新版本",
        userMessage: "案件已被更新，請重新載入報告草稿後再匯出。",
        retryable: true,
      });
    }
    if (
      !previewableLifecycleStatuses.has(item.lifecycle_status) ||
      !reportableCalculationStatuses.has(item.calculation_status ?? "")
    ) {
      throw new AppProblem({
        code: "REPORT_REQUIRES_CALCULATION",
        title: "目前不能匯出報告草稿",
        userMessage: "請先完成至少一軌有效計算。",
        retryable: false,
      });
    }

    const exportedAt = new Date().toISOString();
    const id = item.report_draft?.id ?? crypto.randomUUID();
    const reportNumber = item.report_draft?.reportNumber ?? draftNumber(item);
    const snapshot = buildSnapshot(item, reportNumber, actor.displayName);
    const reportDraft = {
      id,
      reportNumber,
      snapshotHash: sha256(snapshot),
      status: "DRAFT_EXPORTED" as const,
      snapshot,
      createdBy: actor.id,
      exportedAt,
    };
    return {
      next: {
        ...item,
        lifecycle_status: "REPORT_DRAFT",
        report_draft: reportDraft,
        version: item.version + 1,
        updated_at: exportedAt,
      },
      result: {
        ...reportDraft,
        html: renderReportHtml(snapshot),
        caseVersion: item.version + 1,
      },
    };
  });
}

function buildSnapshot(
  item: CaseRecord,
  reportNumber: string,
  exportedBy: string,
): ReportSnapshotData {
  if (!item.calculations.length) {
    throw new AppProblem({
      code: "REPORT_MISSING_CALCULATION",
      title: "缺少計算紀錄",
      userMessage: "找不到可重現的計算紀錄，請重新計算。",
      retryable: false,
    });
  }
  const runs: SnapshotRun[] = item.calculations.map((run) => ({
    id: run.id,
    track: run.track,
    methodCode: run.methodCode,
    semantics: run.semantics,
    inputHash: run.inputHash,
    raw: run.raw,
    adopted: run.adopted,
    ruleSet: run.ruleSet,
    steps: run.steps,
    warnings: run.warnings,
  }));
  return {
    schemaVersion: "2.0",
    reportNumber,
    case: {
      id: item.id,
      caseGroupId: item.case_group_id,
      caseNo: item.case_no,
      revisionNo: item.revision_no,
      customer: item.customer || "未提供",
      location: item.location || "未提供",
      title: item.title || item.case_no,
      purpose: item.purpose,
      taskCode: item.task_code,
      mode: item.mode,
      lifecycleStatus:
        item.lifecycle_status === "ISSUED" ? "ISSUED" : "REPORT_DRAFT",
      calculationStatus: item.calculation_status ?? "BLOCKED",
    },
    inputs: item.input_payload,
    assessments: item.assessments.map((assessment) => ({
      track: assessment.track,
      status: assessment.status,
      missingFields: assessment.missingFields,
      errors: assessment.errors,
      releaseRelevance: assessment.releaseRelevance,
    })),
    runs,
    overrides: item.overrides.map((override) => ({
      resultPath: override.resultPath,
      beforeValue: override.beforeValue,
      afterValue: override.afterValue,
      reason: override.reason,
      evidence: override.evidence,
      requestedBy: override.requestedBy,
      approvedBy: override.approvedBy,
    })),
    actors: {
      preparedBy: item.prepared_by_name ?? item.created_by_name,
      exportedBy,
    },
    limitation:
      "本文件為瀏覽器產生的報告草稿，不代表公司身分驗證或公司簽核效力。",
  };
}
