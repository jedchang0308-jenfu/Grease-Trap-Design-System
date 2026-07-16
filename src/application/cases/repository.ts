import type { PoolClient } from "pg";
import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";

export interface CaseRow {
  id: string;
  case_group_id: string;
  case_no: string;
  revision_no: number;
  customer: string;
  location: string;
  title: string;
  purpose: string;
  dining_type: string | null;
  task_code: string;
  mode: string;
  lifecycle_status: string;
  calculation_status: string | null;
  input_payload: Record<string, unknown>;
  version: number;
  created_by: string;
  prepared_by: string | null;
  reviewed_by: string | null;
  issued_by: string | null;
  created_at: Date;
  updated_at: Date;
}

export async function getLatestCase(
  client: PoolClient,
  caseGroupId: string,
  user: AuthenticatedUser,
  lock = false,
): Promise<CaseRow> {
  const result = await client.query<CaseRow>(
    `SELECT * FROM calculation_cases
      WHERE case_group_id = $1
      ORDER BY revision_no DESC LIMIT 1 ${lock ? "FOR UPDATE" : ""}`,
    [caseGroupId],
  );
  const row = result.rows[0];
  if (!row) {
    throw new AppProblem({
      code: "CASE_NOT_FOUND",
      title: "找不到案件",
      userMessage: "找不到這筆案件，請返回案件清單。",
      status: 404,
    });
  }
  const canReadAll =
    user.roles.includes("SYSTEM_ADMIN") || user.roles.includes("RULE_ADMIN");
  if (!canReadAll && row.created_by !== user.id) {
    throw new AppProblem({
      code: "CASE_ACCESS_DENIED",
      title: "無權存取",
      userMessage: "你沒有這筆案件的存取權限，請返回安全頁面。",
      status: 403,
    });
  }
  return row;
}

export async function deleteCaseGroup(
  client: PoolClient,
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  const latest = await getLatestCase(client, caseGroupId, user, true);
  const revisions = await client.query<{
    id: string;
    revisionNo: number;
    lifecycleStatus: string;
  }>(
    `SELECT id, revision_no AS "revisionNo", lifecycle_status AS "lifecycleStatus"
       FROM calculation_cases
      WHERE case_group_id=$1
      ORDER BY revision_no DESC
      FOR UPDATE`,
    [caseGroupId],
  );

  await client.query(
    `CREATE TEMP TABLE case_delete_revisions (
       id uuid PRIMARY KEY
     ) ON COMMIT DROP`,
  );
  await client.query(
    `INSERT INTO case_delete_revisions(id)
     SELECT id FROM calculation_cases WHERE case_group_id=$1`,
    [caseGroupId],
  );

  await client.query(
    "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, metadata_json) VALUES($1,'CASE_DELETED','CASE',$2,$3)",
    [
      user.id,
      latest.id,
      {
        caseGroupId,
        caseNo: latest.case_no,
        deletedRevisions: revisions.rows.map((revision) => ({
          revisionNo: revision.revisionNo,
          lifecycleStatus: revision.lifecycleStatus,
        })),
      },
    ],
  );

  await client.query(
    `DELETE FROM warnings
      WHERE owner_type='CALCULATION_RUN'
        AND owner_id IN (
          SELECT cr.id
            FROM calculation_runs cr
            JOIN case_delete_revisions cdr ON cdr.id=cr.case_revision_id
        )`,
  );
  await client.query(
    `DELETE FROM calculation_steps
      WHERE run_id IN (
        SELECT cr.id
          FROM calculation_runs cr
          JOIN case_delete_revisions cdr ON cdr.id=cr.case_revision_id
      )`,
  );
  await client.query(
    `DELETE FROM track_assessments
      WHERE request_id IN (
        SELECT id FROM calculation_requests
         WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)
      )`,
  );
  await client.query(
    `DELETE FROM calculation_runs
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query(
    `DELETE FROM calculation_requests
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query(
    `DELETE FROM engineering_overrides
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query(
    `DELETE FROM review_records
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query(
    `DELETE FROM report_snapshots
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query(
    `DELETE FROM scenario_decisions
      WHERE case_revision_id IN (SELECT id FROM case_delete_revisions)`,
  );
  await client.query("DELETE FROM calculation_cases WHERE case_group_id=$1", [
    caseGroupId,
  ]);

  return {
    caseId: caseGroupId,
    deletedRevisionCount: revisions.rowCount ?? 0,
  };
}
