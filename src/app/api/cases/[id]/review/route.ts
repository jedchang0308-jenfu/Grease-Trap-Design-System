import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/application/auth/require-user";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { completeReview } from "@/application/cases/review-service";

const schema = z.object({
  decision: z.enum(["APPROVED", "RETURNED"]),
  checklist: z.record(z.string(), z.boolean()).optional(),
  note: z.string().max(1000).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const body = schema.safeParse(await request.json());
    if (!body.success)
      throw new AppProblem({
        code: "INVALID_REVIEW",
        title: "覆核資料格式不正確",
        userMessage: "請確認覆核選項後再送出。",
        status: 400,
      });
    const { id } = await context.params;
    return NextResponse.json(await completeReview(id, body.data, user));
  } catch (error) {
    return toProblemResponse(error);
  }
}
