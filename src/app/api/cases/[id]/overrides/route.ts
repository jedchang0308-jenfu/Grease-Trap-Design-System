import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/application/auth/require-user";
import { getLatestCase } from "@/application/cases/repository";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { sha256 } from "@/domain/shared/canonical";
import { withTransaction } from "@/infrastructure/db/pool";

const schema = z.object({
  resultPath: z.string().trim().min(1).max(200),
  beforeValue: z.string().trim().min(1).max(100),
  afterValue: z.string().trim().min(1).max(100),
  reason: z.string().trim().min(3).max(1000),
  evidence: z.string().trim().min(3).max(1000),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success)
      throw new AppProblem({
        code: "INVALID_OVERRIDE",
        title: "人工採用資料不完整",
        userMessage: "請填寫前值、後值、理由與依據後再核准。",
        status: 400,
      });
    if (parsed.data.beforeValue === parsed.data.afterValue)
      throw new AppProblem({
        code: "OVERRIDE_NOT_CHANGED",
        title: "採用值沒有變更",
        userMessage: "前值與後值相同，不需要建立人工採用紀錄。",
        status: 400,
      });
    const { id } = await context.params;
    const result = await withTransaction(async (client) => {
      const item = await getLatestCase(client, id, user, true);
      if (item.lifecycle_status !== "IN_REVIEW")
        throw new AppProblem({
          code: "OVERRIDE_REQUIRES_REVIEW",
          title: "目前不能核准人工採用",
          userMessage: "請先把案件提交覆核，再建立人工採用紀錄。",
          status: 409,
        });
      const overrideId = randomUUID();
      await client.query(
        `INSERT INTO engineering_overrides(
           id, case_revision_id, result_path, before_value, after_value, reason, evidence,
           requested_by, approved_by, status
         ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$8,'APPROVED')`,
        [
          overrideId,
          item.id,
          parsed.data.resultPath,
          JSON.stringify(parsed.data.beforeValue),
          JSON.stringify(parsed.data.afterValue),
          parsed.data.reason,
          parsed.data.evidence,
          user.id,
        ],
      );
      await client.query(
        "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, after_hash, metadata_json) VALUES($1,'ENGINEERING_OVERRIDE_APPROVED','CASE',$2,$3,$4)",
        [
          user.id,
          item.id,
          sha256(parsed.data),
          { overrideId, resultPath: parsed.data.resultPath },
        ],
      );
      return {
        id: overrideId,
        ...parsed.data,
        status: "APPROVED",
        requestedBy: user.id,
        approvedBy: user.id,
      };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toProblemResponse(error);
  }
}
