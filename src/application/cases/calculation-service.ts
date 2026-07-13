import { randomUUID } from "node:crypto";
import type { PoolClient } from "pg";
import { AppProblem } from "@/application/http/problem";
import {
  deriveCaseStatus,
  orchestrateCalculation,
  type TrackAssessment,
} from "@/domain/calculation/orchestration";
import type { CurrentResult } from "@/domain/calculation/current";
import type { LegacyResult } from "@/domain/calculation/legacy";
import { sha256 } from "@/domain/shared/canonical";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { withTransaction } from "@/infrastructure/db/pool";
import { getLatestCase } from "./repository";
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

  return withTransaction(async (client) => {
    const caseRow = await getLatestCase(client, request.caseId, user, true);
    const existing = await client.query<{
      payload_hash: string;
      response_json: unknown;
    }>(
      "SELECT payload_hash, response_json FROM calculation_requests WHERE case_revision_id=$1 AND idempotency_key=$2",
      [caseRow.id, request.idempotencyKey],
    );
    if (existing.rows[0]) {
      if (existing.rows[0].payload_hash !== payloadHash) {
        throw new AppProblem({
          code: "IDEMPOTENCY_CONFLICT",
          title: "重送內容不一致",
          userMessage: "相同重送識別碼已用於不同內容，請重新整理後再試。",
          status: 409,
        });
      }
      return existing.rows[0].response_json;
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

    const requestId = randomUUID();
    await client.query(
      "INSERT INTO calculation_requests(id, case_revision_id, idempotency_key, payload_hash, created_by) VALUES($1,$2,$3,$4,$5)",
      [requestId, caseRow.id, request.idempotencyKey, payloadHash, user.id],
    );

    const domainResult = orchestrateCalculation({
      taskCode: request.taskCode,
      mode: request.mode,
      currentInputs: request.currentInputs,
      legacyInputs: request.legacyInputs,
    });
    const actualAssessments: TrackAssessment[] = [];
    const calculationRunIds: string[] = [];
    const persistedResults: Record<string, unknown> = {};

    for (const assessment of domainResult.trackAssessments) {
      const savepoint =
        assessment.track === "CURRENT_QG" ? "track_current" : "track_legacy";
      await client.query(`SAVEPOINT ${savepoint}`);
      let persistedRunId: string | null = null;
      let persistedResult: unknown;
      try {
        const result = domainResult.results[assessment.track];
        const rule = await client.query<{ id: string }>(
          "SELECT id FROM rule_sets WHERE method_family=$1 AND status='ACTIVE'",
          [assessment.track],
        );
        const ruleSetId = rule.rows[0]?.id ?? null;
        let runId: string | null = null;
        if (result && assessment.status === "CALCULATED") {
          runId = randomUUID();
          await persistRun(client, {
            runId,
            requestId,
            caseRevisionId: caseRow.id,
            taskCode: request.taskCode,
            track: assessment.track,
            ruleSetId,
            inputHash: sha256(
              assessment.track === "CURRENT_QG"
                ? request.currentInputs
                : request.legacyInputs,
            ),
            result,
          });
          persistedRunId = runId;
          persistedResult = result;
        }
        await persistAssessment(client, requestId, assessment, ruleSetId);
        actualAssessments.push(assessment);
        await client.query(`RELEASE SAVEPOINT ${savepoint}`);
        if (persistedRunId) calculationRunIds.push(persistedRunId);
        if (persistedResult)
          persistedResults[assessment.track] = persistedResult;
      } catch {
        await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
        const failed: TrackAssessment = {
          ...assessment,
          status: "ERROR",
          errors: ["此軌保存失敗，未建立計算結果。"],
        };
        await persistAssessment(client, requestId, failed, null);
        actualAssessments.push(failed);
      }
    }

    const status = deriveCaseStatus(
      request.mode,
      actualAssessments.map((item) => item.status),
    );
    const newVersion = caseRow.version + 1;
    await client.query(
      `UPDATE calculation_cases
          SET input_payload=$2, calculation_status=$3,
              lifecycle_status=$4, version=$5, prepared_by=$6, updated_at=now()
        WHERE id=$1`,
      [
        caseRow.id,
        JSON.stringify({
          currentInputs: request.currentInputs,
          legacyInputs: request.legacyInputs,
        }),
        status,
        status === "BLOCKED" ? "INPUT_READY" : "CALCULATED",
        newVersion,
        user.id,
      ],
    );
    await replaceCaseInputs(
      client,
      caseRow.id,
      request.currentInputs,
      request.legacyInputs,
    );

    const response = {
      requestId,
      caseId: request.caseId,
      revisionNo: caseRow.revision_no,
      taskCode: request.taskCode,
      mode: request.mode,
      methodCodes: Object.values(persistedResults).map(
        (result) => (result as { methodCode: string }).methodCode,
      ),
      status,
      releaseEligible: status !== "BLOCKED",
      trackAssessments: actualAssessments,
      calculationRunIds,
      currentResult: persistedResults.CURRENT_QG,
      legacyResult: persistedResults.LEGACY_QV,
      warnings: Object.values(persistedResults).flatMap(
        (result) => (result as { warnings: unknown[] }).warnings,
      ),
      ruleSetSnapshots: actualAssessments.map((item) => ({
        track: item.track,
        version: item.ruleSetVersion,
      })),
      caseVersion: newVersion,
    };
    await client.query(
      "UPDATE calculation_requests SET response_json=$2 WHERE id=$1",
      [requestId, response],
    );
    await client.query(
      "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, after_hash, metadata_json) VALUES($1,'CALCULATION_COMPLETED','CASE',$2,$3,$4)",
      [
        user.id,
        caseRow.id,
        sha256(response),
        { requestId, status, tracks: actualAssessments },
      ],
    );
    return response;
  });
}

async function persistAssessment(
  client: PoolClient,
  requestId: string,
  assessment: TrackAssessment,
  ruleSetId: string | null,
) {
  await client.query(
    `INSERT INTO track_assessments(request_id, track, status, required_fields_json, missing_fields_json, errors_json, rule_set_id, release_relevance)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
    [
      requestId,
      assessment.track,
      assessment.status,
      JSON.stringify(assessment.requiredFields),
      JSON.stringify(assessment.missingFields),
      JSON.stringify(assessment.errors),
      ruleSetId,
      assessment.releaseRelevance,
    ],
  );
}

async function persistRun(
  client: PoolClient,
  values: {
    runId: string;
    requestId: string;
    caseRevisionId: string;
    taskCode: string;
    track: string;
    ruleSetId: string | null;
    inputHash: string;
    result: CurrentResult | LegacyResult;
  },
) {
  if (!values.ruleSetId)
    throw new Error(`No active rule set for ${values.track}`);
  await client.query(
    `INSERT INTO calculation_runs(id, request_id, case_revision_id, track, task_code, method_code, rule_set_id, input_hash, result_semantics, raw_result_json, adopted_result_json)
     VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      values.runId,
      values.requestId,
      values.caseRevisionId,
      values.track,
      values.taskCode,
      values.result.methodCode,
      values.ruleSetId,
      values.inputHash,
      values.result.semantics,
      values.result.raw,
      values.result.adopted,
    ],
  );
  for (const item of values.result.steps) {
    await client.query(
      `INSERT INTO calculation_steps(run_id, sequence, formula_code, expression, substitution, result, unit, source_ref)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
      [
        values.runId,
        item.sequence,
        item.formulaCode,
        item.expression,
        item.substitution,
        item.result,
        item.unit,
        item.sourceRef,
      ],
    );
  }
  for (const warning of values.result.warnings) {
    await client.query(
      `INSERT INTO warnings(owner_type, owner_id, code, severity, track, message, details_json)
       VALUES('CALCULATION_RUN',$1,$2,$3,$4,$5,$6)`,
      [
        values.runId,
        warning.code,
        warning.severity,
        values.track,
        warning.message,
        warning.details ?? {},
      ],
    );
  }
}

async function replaceCaseInputs(
  client: PoolClient,
  caseRevisionId: string,
  current: unknown,
  legacy: unknown,
) {
  await client.query("DELETE FROM case_inputs WHERE case_revision_id=$1", [
    caseRevisionId,
  ]);
  for (const [track, input] of [
    ["CURRENT_QG", current],
    ["LEGACY_QV", legacy],
  ] as const) {
    if (!input || typeof input !== "object") continue;
    for (const [field, value] of Object.entries(input)) {
      if (field === "kind" || typeof value === "object" || value === undefined)
        continue;
      const normalized =
        typeof value === "number" || /^-?\d+(\.\d+)?$/.test(String(value))
          ? String(value)
          : null;
      await client.query(
        `INSERT INTO case_inputs(case_revision_id, track, field_code, raw_value, normalized_decimal)
         VALUES($1,$2,$3,$4,$5)`,
        [caseRevisionId, track, field, String(value), normalized],
      );
    }
  }
}
