import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import { previewReport } from "@/application/reports/report-service";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    const preview = await previewReport(id, user);
    return NextResponse.json({
      snapshotHash: preview.snapshotHash,
      reportNumber: preview.snapshot.reportNumber,
      case: preview.snapshot.case,
      assessments: preview.snapshot.assessments,
      overrides: preview.snapshot.overrides,
      actors: preview.snapshot.actors,
      html: preview.html,
    });
  } catch (error) {
    return toProblemResponse(error);
  }
}
