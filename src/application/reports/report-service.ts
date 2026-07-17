import { randomBytes, randomUUID } from "node:crypto";
import {
  commitIssuedReport,
  getLatestCase,
  getReport,
} from "@/application/cases/repository";
import { AppProblem } from "@/application/http/problem";
import { renderReportHtml } from "@/domain/report/html";
import type { ReportSnapshotData, SnapshotRun } from "@/domain/report/types";
import { sha256 } from "@/domain/shared/canonical";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import type {
  CaseRecord,
  ReportRecord,
} from "@/infrastructure/data/case-store";
import { renderPdfBufferFromHtml } from "@/infrastructure/pdf/playwright-pdf";
import { reportStorage } from "@/infrastructure/storage/report-storage";

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const previewableLifecycleStatuses = new Set([
  "CALCULATED",
  "IN_REVIEW",
  "REVIEWED",
  "ISSUED",
]);
const issueableLifecycleStatuses = new Set([
  "CALCULATED",
  "IN_REVIEW",
  "REVIEWED",
]);
const issueableCalculationStatuses = new Set([
  "COMPLETE",
  "COMPLETE_WITH_REMINDER",
]);

function makeUlid() {
  let timestamp = Date.now();
  let value = "";
  for (let index = 0; index < 10; index += 1) {
    value = crockford[timestamp % 32] + value;
    timestamp = Math.floor(timestamp / 32);
  }
  const random = randomBytes(10);
  for (let index = 0; index < 16; index += 1) {
    value += crockford[random[index % random.length] % 32];
  }
  return value;
}

function makeReportNumber() {
  return `RDR-${makeUlid()}`;
}

export async function previewReport(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const item = await getLatestCase(caseGroupId, user);
  if (!previewableLifecycleStatuses.has(item.lifecycle_status)) {
    throw new AppProblem({
      code: "REPORT_REQUIRES_CALCULATION",
      title: "報告尚未可預覽",
      userMessage: "請先完成有效計算，再建立報告預覽。",
      status: 409,
    });
  }

  const existing = item.latestReportId
    ? await getReport(item.latestReportId, user)
    : null;
  const snapshot =
    existing?.snapshot ?? buildSnapshot(item, makeReportNumber(), user);
  const snapshotHash = existing?.snapshotHash ?? sha256(snapshot);
  return { snapshot, snapshotHash, html: renderReportHtml(snapshot) };
}

export async function issueReport(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const item = await getLatestCase(caseGroupId, user);
  if (item.lifecycle_status === "ISSUED" && item.latestReportId) {
    return presentReport(await getReport(item.latestReportId, user));
  }
  if (
    !issueableLifecycleStatuses.has(item.lifecycle_status) ||
    !issueableCalculationStatuses.has(item.calculation_status ?? "")
  ) {
    throw new AppProblem({
      code: "ISSUE_REQUIRES_CALCULATION",
      title: "目前不能核發",
      userMessage: "請先完成有效計算，再核發此版本。",
      status: 409,
    });
  }

  const id = randomUUID();
  const reportNumber = makeReportNumber();
  const snapshot = buildSnapshot(item, reportNumber, user, true);
  const snapshotHash = sha256(snapshot);
  const issuedAt = new Date().toISOString();
  const pdf = await renderPdfBufferFromHtml(renderReportHtml(snapshot));
  const storagePath = await reportStorage.save(id, reportNumber, pdf);
  const report: ReportRecord = {
    id,
    caseGroupId,
    revisionNo: item.revision_no,
    snapshot,
    snapshotHash,
    reportNumber,
    status: "ISSUED",
    storagePath,
    createdBy: user.id,
    issuedBy: user.id,
    issuedAt,
  };

  try {
    const committed = await commitIssuedReport(
      caseGroupId,
      item.version,
      report,
      user,
    );
    if (committed.id !== report.id) await reportStorage.delete(storagePath);
    return presentReport(committed);
  } catch (error) {
    await reportStorage.delete(storagePath);
    throw error;
  }
}

function presentReport(report: ReportRecord) {
  return {
    id: report.id,
    reportNumber: report.reportNumber,
    snapshotHash: report.snapshotHash,
    status: report.status,
    issuedAt: report.issuedAt,
    downloadUrl: `/api/reports/${report.id}/download`,
  };
}

function buildSnapshot(
  item: CaseRecord,
  reportNumber: string,
  user: AuthenticatedUser,
  forIssue = false,
): ReportSnapshotData {
  if (!item.calculations.length) {
    throw new AppProblem({
      code: "REPORT_MISSING_CALCULATION",
      title: "缺少計算紀錄",
      userMessage: "找不到可重現的計算紀錄，請重新計算。",
      status: 409,
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
    schemaVersion: "1.0",
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
      lifecycleStatus: forIssue ? "ISSUED" : item.lifecycle_status,
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
      issuedBy: forIssue ? user.displayName : "尚未核發",
    },
    limitation: "本報告未執行特定產品或證書符合性判定。",
  };
}
