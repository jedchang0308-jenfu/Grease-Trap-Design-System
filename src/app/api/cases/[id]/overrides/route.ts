import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/application/auth/require-user";
import { mutateCase } from "@/application/cases/repository";
import { AppProblem, toProblemResponse } from "@/application/http/problem";

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
    if (!parsed.success) {
      throw new AppProblem({
        code: "INVALID_OVERRIDE",
        title: "人工採用資料不完整",
        userMessage: "請填寫前值、後值、理由與依據後再核准。",
        status: 400,
      });
    }
    if (parsed.data.beforeValue === parsed.data.afterValue) {
      throw new AppProblem({
        code: "OVERRIDE_NOT_CHANGED",
        title: "採用值沒有變更",
        userMessage: "前值與後值相同，不需要建立人工採用紀錄。",
        status: 400,
      });
    }
    const { id } = await context.params;
    const overrideId = randomUUID();
    const result = await mutateCase(id, user, (item) => {
      if (item.lifecycle_status !== "CALCULATED") {
        throw new AppProblem({
          code: "OVERRIDE_REQUIRES_DRAFT",
          title: "目前不能修改報告草稿",
          userMessage: "人工採用必須在送出最終審核前完成。",
          status: 409,
        });
      }
      const createdAt = new Date().toISOString();
      const override = {
        id: overrideId,
        ...parsed.data,
        status: "APPROVED" as const,
        requestedBy: user.id,
        approvedBy: user.id,
        createdAt,
      };
      return {
        next: {
          ...item,
          overrides: [...item.overrides, override],
          version: item.version + 1,
          updated_at: createdAt,
        },
        result: override,
      };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return toProblemResponse(error);
  }
}
