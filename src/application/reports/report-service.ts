import { randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import type { PoolClient } from "pg";
import { AppProblem } from "@/application/http/problem";
import { renderReportHtml } from "@/domain/report/html";
import type { ReportSnapshotData, SnapshotRun } from "@/domain/report/types";
import { sha256 } from "@/domain/shared/canonical";
import { env } from "@/config/env";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { pool, withTransaction } from "@/infrastructure/db/pool";
import { renderPdfFromHtml } from "@/infrastructure/pdf/playwright-pdf";
import { getLatestCase } from "@/application/cases/repository";

const crockford = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

function makeUlid() {
  let timestamp = Date.now();
  let value = "";
  for (let index = 0; index < 10; index += 1) {
    value = crockford[timestamp % 32] + value;
    timestamp = Math.floor(timestamp / 32);
  }
  const random = randomBytes(10);
  for (let index = 0; index < 16; index += 1)
    value += crockford[random[index % random.length] % 32];
  return value;
}

export async function previewReport(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const client = await pool.connect();
  try {
    const item = await getLatestCase(client, caseGroupId, user);
    if (!["REVIEWED", "ISSUED"].includes(item.lifecycle_status)) {
      throw new AppProblem({
        code: "REPORT_REQUIRES_REVIEW",
        title: "報告尚未可預覽",
        userMessage: "請先完成工程覆核，再預覽與核發報告。",
        status: 409,
      });
    }
    const existing = await client.query<{
      report_number: string;
      snapshot_json: ReportSnapshotData;
      snapshot_hash: string;
    }>(
      "SELECT report_number, snapshot_json, snapshot_hash FROM report_snapshots WHERE case_revision_id=$1 ORDER BY created_at DESC LIMIT 1",
      [item.id],
    );
    const snapshot =
      existing.rows[0]?.snapshot_json ??
      (await buildSnapshot(client, item.id, `DRAFT-${makeUlid()}`, user));
    const snapshotHash = existing.rows[0]?.snapshot_hash ?? sha256(snapshot);
    return { snapshot, snapshotHash, html: renderReportHtml(snapshot) };
  } finally {
    client.release();
  }
}

export async function issueReport(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const pending = await withTransaction(async (client) => {
    const item = await getLatestCase(client, caseGroupId, user, true);
    if (item.lifecycle_status === "ISSUED") {
      const existingIssued = await client.query(
        "SELECT * FROM report_snapshots WHERE case_revision_id=$1 AND status='ISSUED' ORDER BY issued_at DESC LIMIT 1",
        [item.id],
      );
      if (existingIssued.rows[0])
        return { row: existingIssued.rows[0], item, alreadyIssued: true };
    }
    if (item.lifecycle_status !== "REVIEWED") {
      throw new AppProblem({
        code: "ISSUE_REQUIRES_REVIEW",
        title: "目前不能核發",
        userMessage: "請先完成工程覆核，再核發此版本。",
        status: 409,
      });
    }
    const existingPending = await client.query(
      "SELECT * FROM report_snapshots WHERE case_revision_id=$1 AND status='PENDING' ORDER BY created_at DESC LIMIT 1",
      [item.id],
    );
    if (existingPending.rows[0])
      return { row: existingPending.rows[0], item, alreadyIssued: false };
    const id = randomUUID();
    const reportNumber = `DRAFT-${makeUlid()}`;
    const snapshot = await buildSnapshot(client, item.id, reportNumber, user);
    const snapshotHash = sha256(snapshot);
    const inserted = await client.query(
      `INSERT INTO report_snapshots(id, case_revision_id, snapshot_json, snapshot_hash, report_number, status, created_by)
       VALUES($1,$2,$3,$4,$5,'PENDING',$6) RETURNING *`,
      [id, item.id, snapshot, snapshotHash, reportNumber, user.id],
    );
    return { row: inserted.rows[0], item, alreadyIssued: false };
  });

  if (pending.alreadyIssued) return presentReport(pending.row);
  const snapshot = pending.row.snapshot_json as ReportSnapshotData;
  const relativePath = path.posix.join(
    env.REPORT_OUTPUT_DIR.replaceAll("\\", "/"),
    `${pending.row.report_number}.pdf`,
  );
  await renderPdfFromHtml(renderReportHtml(snapshot), relativePath);

  const issued = await withTransaction(async (client) => {
    const locked = await client.query(
      "SELECT * FROM report_snapshots WHERE id=$1 FOR UPDATE",
      [pending.row.id],
    );
    if (locked.rows[0].status === "ISSUED") return locked.rows[0];
    const updated = await client.query(
      `UPDATE report_snapshots SET status='ISSUED', pdf_path=$2, issued_by=$3, issued_at=now()
        WHERE id=$1 RETURNING *`,
      [pending.row.id, relativePath, user.id],
    );
    await client.query(
      "UPDATE calculation_cases SET lifecycle_status='ISSUED', issued_by=$2, version=version+1, updated_at=now() WHERE id=$1 AND lifecycle_status='REVIEWED'",
      [pending.item.id, user.id],
    );
    await client.query(
      "UPDATE calculation_cases SET lifecycle_status='SUPERSEDED', updated_at=now() WHERE case_group_id=$1 AND revision_no<$2 AND lifecycle_status='ISSUED'",
      [pending.item.case_group_id, pending.item.revision_no],
    );
    await client.query(
      "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, after_hash, metadata_json) VALUES($1,'REPORT_ISSUED','CASE',$2,$3,$4)",
      [
        user.id,
        pending.item.id,
        pending.row.snapshot_hash,
        { reportId: pending.row.id, reportNumber: pending.row.report_number },
      ],
    );
    return updated.rows[0];
  });
  return presentReport(issued);
}

function presentReport(row: Record<string, unknown>) {
  return {
    id: row.id,
    reportNumber: row.report_number,
    snapshotHash: row.snapshot_hash,
    status: row.status,
    issuedAt: row.issued_at,
    downloadUrl: `/api/reports/${row.id}/download`,
  };
}

async function buildSnapshot(
  client: PoolClient,
  caseRevisionId: string,
  reportNumber: string,
  user: AuthenticatedUser,
): Promise<ReportSnapshotData> {
  const caseResult = await client.query(
    `SELECT c.*, prepared.display_name AS prepared_name, reviewed.display_name AS reviewed_name
       FROM calculation_cases c
       LEFT JOIN users prepared ON prepared.id=c.prepared_by
       LEFT JOIN users reviewed ON reviewed.id=c.reviewed_by
      WHERE c.id=$1`,
    [caseRevisionId],
  );
  const item = caseResult.rows[0];
  const requests = await client.query<{ id: string }>(
    "SELECT id FROM calculation_requests WHERE case_revision_id=$1 ORDER BY created_at DESC LIMIT 1",
    [caseRevisionId],
  );
  const requestId = requests.rows[0]?.id;
  if (!requestId)
    throw new AppProblem({
      code: "REPORT_MISSING_CALCULATION",
      title: "缺少計算紀錄",
      userMessage: "找不到可重現的計算紀錄，請重新計算與覆核。",
      status: 409,
    });
  const runRows = await client.query(
    `SELECT cr.*, rs.code AS rule_code, rs.version AS rule_version, rs.checksum AS rule_checksum,
            sd.code AS source_code, sd.title AS source_title, sd.sha256 AS source_hash
       FROM calculation_runs cr JOIN rule_sets rs ON rs.id=cr.rule_set_id
       JOIN source_documents sd ON sd.id=rs.source_document_id
      WHERE cr.request_id=$1 ORDER BY cr.track`,
    [requestId],
  );
  const runs: SnapshotRun[] = [];
  for (const run of runRows.rows) {
    const steps = await client.query(
      `SELECT sequence, formula_code AS "formulaCode", expression, substitution, result::text, unit, source_ref AS "sourceRef"
         FROM calculation_steps WHERE run_id=$1 ORDER BY sequence`,
      [run.id],
    );
    const warnings = await client.query(
      `SELECT code, severity, message, details_json AS details FROM warnings WHERE owner_type='CALCULATION_RUN' AND owner_id=$1 ORDER BY id`,
      [run.id],
    );
    runs.push({
      id: run.id,
      track: run.track,
      methodCode: run.method_code,
      semantics: run.result_semantics,
      inputHash: run.input_hash,
      raw: run.raw_result_json,
      adopted: run.adopted_result_json,
      ruleSet: {
        code: run.rule_code,
        version: run.rule_version,
        checksum: run.rule_checksum,
        sourceCode: run.source_code,
        sourceTitle: run.source_title,
        sourceHash: run.source_hash,
      },
      steps: steps.rows,
      warnings: warnings.rows,
    });
  }
  const assessments = await client.query(
    `SELECT track, status, missing_fields_json AS "missingFields", errors_json AS errors, release_relevance AS "releaseRelevance"
       FROM track_assessments WHERE request_id=$1 ORDER BY track`,
    [requestId],
  );
  const overrides = await client.query(
    `SELECT result_path AS "resultPath", before_value AS "beforeValue", after_value AS "afterValue", reason, evidence,
            requested_by::text AS "requestedBy", approved_by::text AS "approvedBy"
       FROM engineering_overrides WHERE case_revision_id=$1 AND status='APPROVED' ORDER BY created_at`,
    [caseRevisionId],
  );
  const reviews = await client.query(
    `SELECT prepared.display_name AS "preparedBy", reviewed.display_name AS "reviewedBy",
            rr.checklist_json AS checklist, rr.decision, rr.note, rr.reviewed_at AS "reviewedAt"
       FROM review_records rr JOIN users prepared ON prepared.id=rr.prepared_by JOIN users reviewed ON reviewed.id=rr.reviewed_by
      WHERE rr.case_revision_id=$1 AND rr.decision='APPROVED' ORDER BY rr.reviewed_at DESC LIMIT 1`,
    [caseRevisionId],
  );
  const review = reviews.rows[0];
  if (!review)
    throw new AppProblem({
      code: "REPORT_MISSING_REVIEW",
      title: "缺少覆核紀錄",
      userMessage: "找不到完整覆核紀錄，請先完成覆核。",
      status: 409,
    });
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
      lifecycleStatus: item.lifecycle_status,
      calculationStatus: item.calculation_status,
    },
    inputs: item.input_payload,
    assessments: assessments.rows,
    runs,
    overrides: overrides.rows,
    review,
    actors: {
      preparedBy: item.prepared_name,
      reviewedBy: item.reviewed_name,
      issuedBy: user.displayName,
    },
    limitation: "本報告未執行特定產品或證書符合性判定。",
  };
}
