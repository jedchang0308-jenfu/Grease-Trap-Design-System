import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import {
  deleteCaseGroup,
  getLatestCase,
} from "@/application/cases/repository";
import { pool, withTransaction } from "@/infrastructure/db/pool";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const client = await pool.connect();
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const item = await getLatestCase(client, id, user);
    const calculations = await client.query(
      `SELECT cr.id, cr.track, cr.method_code AS "methodCode", cr.result_semantics AS semantics,
              cr.raw_result_json AS raw, cr.adopted_result_json AS adopted, cr.created_at AS "createdAt"
         FROM calculation_runs cr
        WHERE cr.case_revision_id=$1 ORDER BY cr.created_at DESC`,
      [item.id],
    );
    const assessments = await client.query(
      `SELECT ta.track, ta.status, ta.missing_fields_json AS "missingFields", ta.errors_json AS errors,
              ta.release_relevance AS "releaseRelevance", ta.assessed_at AS "assessedAt"
         FROM track_assessments ta
         JOIN calculation_requests req ON req.id=ta.request_id
        WHERE req.case_revision_id=$1 ORDER BY ta.assessed_at DESC`,
      [item.id],
    );
    const reports = await client.query(
      `SELECT id, snapshot_hash AS "snapshotHash", report_number AS "reportNumber", status,
              pdf_path AS "pdfPath", issued_at AS "issuedAt"
         FROM report_snapshots WHERE case_revision_id=$1 ORDER BY created_at DESC`,
      [item.id],
    );
    const overrides = await client.query(
      `SELECT id, result_path AS "resultPath", before_value AS "beforeValue", after_value AS "afterValue",
              reason, evidence, status, requested_by AS "requestedBy", approved_by AS "approvedBy", created_at AS "createdAt"
         FROM engineering_overrides WHERE case_revision_id=$1 ORDER BY created_at`,
      [item.id],
    );
    return NextResponse.json({
      ...item,
      caseId: item.case_group_id,
      calculations: calculations.rows,
      assessments: assessments.rows,
      reports: reports.rows,
      overrides: overrides.rows,
    });
  } catch (error) {
    return toProblemResponse(error);
  } finally {
    client.release();
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    const deleted = await withTransaction((client) =>
      deleteCaseGroup(client, id, user),
    );
    return NextResponse.json(deleted);
  } catch (error) {
    return toProblemResponse(error);
  }
}
