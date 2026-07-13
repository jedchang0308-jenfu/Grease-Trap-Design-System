import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import { submitForReview } from "@/application/cases/review-service";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    return NextResponse.json(await submitForReview(id, user));
  } catch (error) {
    return toProblemResponse(error);
  }
}
