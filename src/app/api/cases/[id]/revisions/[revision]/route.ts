import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { mutateCase } from "@/application/cases/repository";
import { patchCaseSchema } from "@/application/cases/schemas";
import { AppProblem, toProblemResponse } from "@/application/http/problem";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string; revision: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const parsed = patchCaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppProblem({
        code: "INVALID_CASE_PATCH",
        title: "案件資料格式不正確",
        userMessage: "請修正欄位後再儲存；已填資料已保留。",
        status: 400,
      });
    }
    const { id, revision } = await context.params;
    const result = await mutateCase(id, user, (item) => {
      if (item.revision_no !== Number(revision)) {
        throw new AppProblem({
          code: "REVISION_NOT_CURRENT",
          title: "修訂版已變更",
          userMessage: "目前已有較新的修訂版，請重新載入。",
          status: 409,
        });
      }
      if (item.version !== parsed.data.expectedCaseVersion) {
        throw new AppProblem({
          code: "STALE_CASE_VERSION",
          title: "案件已有新版本",
          userMessage: "案件已更新，請重新載入後再儲存。",
          status: 409,
        });
      }
      if (["ISSUED", "SUPERSEDED"].includes(item.lifecycle_status)) {
        throw new AppProblem({
          code: "ISSUED_CASE_IMMUTABLE",
          title: "已核發版本不可修改",
          userMessage: "若內容要改，請建立新修訂版。",
          status: 409,
        });
      }
      const now = new Date().toISOString();
      const updated = {
        ...item,
        customer: parsed.data.customer ?? item.customer,
        location: parsed.data.location ?? item.location,
        title: parsed.data.title ?? item.title,
        purpose: parsed.data.purpose ?? item.purpose,
        version: item.version + 1,
        updated_at: now,
      };
      return { next: updated, result: updated };
    });
    return NextResponse.json(result);
  } catch (error) {
    return toProblemResponse(error);
  }
}
