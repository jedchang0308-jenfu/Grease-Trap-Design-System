import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { createCaseSchema } from "@/application/cases/schemas";
import { withTransaction, query } from "@/infrastructure/db/pool";

function makeCaseNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `GTC-${date}-${Math.floor(100000 + Math.random() * 900000)}`;
}

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const parsed = createCaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppProblem({
        code: "INVALID_CASE",
        title: "案件資料不完整",
        userMessage: "請修正標示欄位後再建立案件；已填資料已保留。",
        status: 400,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      });
    }
    const caseGroupId = randomUUID();
    const revisionId = randomUUID();
    const caseNo = makeCaseNumber();
    const item = await withTransaction(async (client) => {
      const result = await client.query(
        `INSERT INTO calculation_cases(
           id, case_group_id, case_no, revision_no, customer, location, title, purpose, dining_type,
           task_code, mode, lifecycle_status, created_by
         ) VALUES($1,$2,$3,1,$4,$5,$6,$7,$8,$9,$10,'DRAFT',$11) RETURNING *`,
        [
          revisionId,
          caseGroupId,
          caseNo,
          parsed.data.customer,
          parsed.data.location,
          parsed.data.title,
          parsed.data.purpose,
          parsed.data.diningType ?? null,
          parsed.data.taskCode,
          parsed.data.mode,
          user.id,
        ],
      );
      await client.query(
        "INSERT INTO scenario_decisions(case_revision_id, selected_mode, reason, decided_by) VALUES($1,$2,$3,$4)",
        [revisionId, parsed.data.mode, "建立案件時由使用者明確選擇", user.id],
      );
      await client.query(
        "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, metadata_json) VALUES($1,'CASE_CREATED','CASE',$2,$3)",
        [
          user.id,
          revisionId,
          { taskCode: parsed.data.taskCode, mode: parsed.data.mode },
        ],
      );
      return result.rows[0];
    });
    return NextResponse.json({ ...item, caseId: caseGroupId }, { status: 201 });
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const url = new URL(request.url);
    const search = url.searchParams.get("search")?.trim() ?? "";
    const mode = url.searchParams.get("mode")?.trim() ?? "";
    const status = url.searchParams.get("status")?.trim() ?? "";
    const canReadAll =
      user.roles.includes("RULE_ADMIN") || user.roles.includes("SYSTEM_ADMIN");
    const result = await query(
      `SELECT DISTINCT ON (case_group_id)
              id, case_group_id AS "caseId", case_no AS "caseNo", revision_no AS "revisionNo",
              customer, location, title, task_code AS "taskCode", mode,
              lifecycle_status AS "lifecycleStatus", calculation_status AS "calculationStatus",
              updated_at AS "updatedAt", version
         FROM calculation_cases
        WHERE ($1::boolean OR created_by=$2)
          AND ($3='' OR customer ILIKE '%'||$3||'%' OR case_no ILIKE '%'||$3||'%' OR title ILIKE '%'||$3||'%')
          AND ($4='' OR mode=$4)
          AND ($5='' OR lifecycle_status=$5 OR calculation_status=$5)
        ORDER BY case_group_id, revision_no DESC`,
      [canReadAll, user.id, search, mode, status],
    );
    return NextResponse.json({ items: result.rows, total: result.rowCount });
  } catch (error) {
    return toProblemResponse(error);
  }
}
