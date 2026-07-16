import { randomUUID } from "node:crypto";
import { AppProblem } from "@/application/http/problem";
import {
  deriveCaseStatus,
  orchestrateCalculation,
} from "@/domain/calculation/orchestration";
import { ruleSnapshot, type RuleTrack } from "@/domain/rules/catalog";
import { sha256 } from "@/domain/shared/canonical";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import type {
  CalculationRequestCache,
  PersistedAssessment,
  PersistedCalculation,
} from "@/infrastructure/data/case-store";
import { mutateCase } from "./repository";
import { calculateRequestSchema } from "./schemas";

export async function calculateCase(payload: unknown, user: AuthenticatedUser) {
  const parsed = calculateRequestSchema.safeParse(payload);
  if (!parsed.success) {
    throw new AppProblem({
      code: "INVALID_CALCULATION_REQUEST",
      title: "計算資料格式不正確",
      userMessage: "請修正標示欄位後再計算；已填資料已保留。",
      status: 400,
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    });
  }

  const request = parsed.data;
  const payloadHash = sha256(request);
  const requestCacheKey = sha256(request.idempotencyKey);
  const requestId = randomUUID();
  const runIds: Record<RuleTrack, string> = {
    CURRENT_QG: randomUUID(),
    LEGACY_QV: randomUUID(),
  };

  return mutateCase(request.caseId, user, (caseRow) => {
    const existing = caseRow.calculationRequests[requestCacheKey];
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        throw new AppProblem({
          code: "IDEMPOTENCY_CONFLICT",
          title: "重送內容不一致",
          userMessage: "相同重送識別碼已用於不同內容，請重新整理後再試。",
          status: 409,
        });
      }
      return { next: caseRow, result: existing.response };
    }

    if (
      ["IN_REVIEW", "REVIEWED", "ISSUED", "SUPERSEDED"].includes(
        caseRow.lifecycle_status,
      )
    ) {
      throw new AppProblem({
        code: "CASE_READ_ONLY",
        title: "目前版本不可重新計算",
        userMessage: "請先退回草稿，或為已核發案件建立新修訂版。",
        status: 409,
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
        status: 409,
        retryable: true,
      });
    }
    if (caseRow.version !== request.expectedCaseVersion) {
      throw new AppProblem({
        code: "STALE_CASE_VERSION",
        title: "案件已有新版本",
        userMessage: "案件已由其他操作更新，請重新載入後再繼續。",
        status: 409,
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
      taskCode: request.taskCode,
      mode: request.mode,
      methodCodes: calculations.map((result) => result.methodCode),
      status,
      releaseEligible: status !== "BLOCKED",
      trackAssessments: assessments.map((assessment) => ({
        track: assessment.track,
        status: assessment.status,
        requiredFields: assessment.requiredFields,
        missingFields: assessment.missingFields,
        errors: assessment.errors,
        releaseRelevance: assessment.releaseRelevance,
        ruleSetVersion: assessment.ruleSetVersion,
      })),
      calculationRunIds: calculations.map((result) => result.id),
      currentResult: domainResult.results.CURRENT_QG,
      legacyResult: domainResult.results.LEGACY_QV,
      warnings: calculations.flatMap((result) => result.warnings),
      ruleSetSnapshots: assessments.map((assessment) => ({
        track: assessment.track,
        version: ruleSnapshot(assessment.track).version,
      })),
      caseVersion: newVersion,
    };

    const requestCache: Record<string, CalculationRequestCache> = {
      ...caseRow.calculationRequests,
      [requestCacheKey]: { payloadHash, response, createdAt: now },
    };
    const trimmedRequestCache = Object.fromEntries(
      Object.entries(requestCache)
        .sort(([, left], [, right]) =>
          right.createdAt.localeCompare(left.createdAt),
        )
        .slice(0, 5),
    );

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
        prepared_by: user.id,
        prepared_by_name: user.displayName,
        reviewed_by: null,
        reviewed_by_name: null,
        issued_by: null,
        issued_by_name: null,
        calculations,
        assessments,
        review: null,
        reports: [],
        latestReportId: null,
        calculationRequests: trimmedRequestCache,
        updated_at: now,
      },
      result: response,
    };
  });
}
