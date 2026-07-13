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
