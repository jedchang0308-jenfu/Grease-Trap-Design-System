import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { issueReport } from "@/application/reports/report-service";
import { toProblemResponse } from "@/application/http/problem";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    return NextResponse.json(await issueReport(id, user));
  } catch (error) {
    return toProblemResponse(error);
  }
}
