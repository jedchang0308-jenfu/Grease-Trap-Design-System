import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { calculateCase } from "@/application/cases/calculation-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    const body = await request.json();
    if (body.caseId !== id) {
      throw new AppProblem({
        code: "CASE_ID_MISMATCH",
        title: "案件識別不一致",
        userMessage: "請重新載入案件後再計算。",
        status: 400,
      });
    }
    return NextResponse.json(await calculateCase(body, user));
  } catch (error) {
    return toProblemResponse(error);
  }
}
