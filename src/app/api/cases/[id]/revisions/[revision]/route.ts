import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { getLatestCase } from "@/application/cases/repository";
import { patchCaseSchema } from "@/application/cases/schemas";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { withTransaction } from "@/infrastructure/db/pool";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const parsed = patchCaseSchema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppProblem({
        code: "INVALID_CASE_PATCH",
        title: "案件資料格式不正確",
        userMessage: "請修正欄位後再儲存；已填資料已保留。",
        status: 400,
      });
    const { id, revision } = await context.params;
    const result = await withTransaction(async (client) => {
      const item = await getLatestCase(client, id, user, true);
      if (item.revision_no !== Number(revision))
        throw new AppProblem({
          code: "REVISION_NOT_CURRENT",
          title: "修訂版已變更",
          userMessage: "目前已有較新的修訂版，請重新載入。",
          status: 409,
        });
      if (item.version !== parsed.data.expectedCaseVersion)
        throw new AppProblem({
          code: "STALE_CASE_VERSION",
          title: "案件已有新版本",
          userMessage: "案件已更新，請重新載入後再儲存。",
          status: 409,
        });
      if (["ISSUED", "SUPERSEDED"].includes(item.lifecycle_status))
        throw new AppProblem({
          code: "ISSUED_CASE_IMMUTABLE",
          title: "已核發版本不可修改",
          userMessage: "若內容要改，請建立新修訂版。",
          status: 409,
        });
      const updated = await client.query(
        `UPDATE calculation_cases SET
           customer=COALESCE($2,customer), location=COALESCE($3,location), title=COALESCE($4,title),
           purpose=COALESCE($5,purpose), version=version+1, updated_at=now()
         WHERE id=$1 RETURNING *`,
        [
          item.id,
          parsed.data.customer ?? null,
          parsed.data.location ?? null,
          parsed.data.title ?? null,
          parsed.data.purpose ?? null,
        ],
      );
      await client.query(
        "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, metadata_json) VALUES($1,'CASE_UPDATED','CASE',$2,$3)",
        [
          user.id,
          item.id,
          {
            fields: Object.keys(parsed.data).filter(
              (key) => key !== "expectedCaseVersion",
            ),
          },
        ],
      );
      return updated.rows[0];
    });
    return NextResponse.json(result);
  } catch (error) {
    return toProblemResponse(error);
  }
}
