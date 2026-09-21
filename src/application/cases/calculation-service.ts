import { AppProblem } from "@/application/problem";
import {
  deriveCaseStatus,
  orchestrateCalculation,
} from "@/domain/calculation/orchestration";
import { ruleSnapshot, type RuleTrack } from "@/domain/rules/catalog";
import { sha256 } from "@/domain/shared/canonical";
import type {
  PersistedAssessment,
  PersistedCalculation,
} from "@/infrastructure/data/case-store";
import { currentActor, mutateCase } from "./repository";
import { calculateRequestSchema } from "./schemas";

export async function calculateCase(payload: unknown) {
  const parsed = calculateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppProblem({
      code: "INVALID_CALCULATION_REQUEST",
      title: "計算資料格式不正確",
      userMessage: "請修正標示欄位後再計算；已填資料仍保留。",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    });
  }

  const request = parsed.data;
  const actor = currentActor();
  const requestId = crypto.randomUUID();
  const runIds: Record<RuleTrack, string> = {
    LEGACY_QV: crypto.randomUUID(),
    CURRENT_QG: crypto.randomUUID(),
  };

  return mutateCase(request.caseId, (caseRow) => {
    if (["ISSUED", "SUPERSEDED"].includes(caseRow.lifecycle_status)) {
      throw new AppProblem({
        code: "LEGACY_CASE_READ_ONLY",
        title: "舊系統歷史版本僅供查閱",
        userMessage: "舊系統歷史資料不能在靜態版重算；請建立新案件。",
        retryable: false,
      });
    }
    if (
      caseRow.revision_no !== request.revisionNo ||
      caseRow.task_code !== request.taskCode ||
      caseRow.mode !== request.mode
    ) {
      throw new AppProblem({
        code: "CASE_CONTRACT_MISMATCH",
        title: "案件資料已變更",
        userMessage: "案件任務或模式已變更，請重新載入後再計算。",
        retryable: true,
      });
    }
    if (caseRow.version !== request.expectedCaseVersion) {
      throw new AppProblem({
        code: "STALE_CASE_VERSION",
        title: "共享案件已有新版本",
        userMessage: "案件已由其他使用者更新，請重新載入後再繼續。",
        retryable: true,
      });
    }

    const domainResult = orchestrateCalculation({
      taskCode: request.taskCode,
      mode: request.mode,
      currentInputs: request.currentInputs,
      legacyInputs: request.legacyInputs,
    });
    const now = new Date().toISOString();
    const assessments: PersistedAssessment[] =
      domainResult.trackAssessments.map((assessment) => ({
        ...assessment,
        assessedAt: now,
      }));
    const calculations: PersistedCalculation[] = [];

    for (const assessment of assessments) {
      const track = assessment.track as RuleTrack;
      const result = domainResult.results[track];
      if (!result || assessment.status !== "CALCULATED") continue;
      calculations.push({
        id: runIds[track],
        track,
        methodCode: result.methodCode,
        semantics: result.semantics,
        inputHash: sha256(
          track === "CURRENT_QG" ? request.currentInputs : request.legacyInputs,
        ),
        raw: result.raw as Record<string, string | null>,
        adopted: result.adopted as Record<string, string | null>,
        ruleSet: ruleSnapshot(track),
        steps: result.steps.map((step) => ({
          ...step,
          result: String(step.result),
        })),
        warnings: result.warnings.map((warning) => ({
          code: warning.code,
          severity: warning.severity,
          message: warning.message,
          details: warning.details ?? {},
        })),
        createdAt: now,
      });
    }

    const status = deriveCaseStatus(
      request.mode,
      assessments.map((assessment) => assessment.status),
    );
    const newVersion = caseRow.version + 1;
    const response = {
      requestId,
      caseId: request.caseId,
      revisionNo: caseRow.revision_no,
      status,
      reportDraftEligible: status !== "BLOCKED",
      caseVersion: newVersion,
    };

    return {
      next: {
        ...caseRow,
        input_payload: {
          currentInputs: request.currentInputs,
          legacyInputs: request.legacyInputs,
        },
        dining_type:
          request.currentInputs && "diningType" in request.currentInputs
            ? request.currentInputs.diningType
            : caseRow.dining_type,
        calculation_status: status,
        lifecycle_status: status === "BLOCKED" ? "INPUT_READY" : "CALCULATED",
        version: newVersion,
        prepared_by: actor.id,
        prepared_by_name: actor.displayName,
        calculations,
        assessments,
        report_draft: null,
        updated_at: now,
      },
      result: response,
    };
  });
}
