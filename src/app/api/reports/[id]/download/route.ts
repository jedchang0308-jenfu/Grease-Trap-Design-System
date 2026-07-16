import { requireUser } from "@/application/auth/require-user";
import { getReport } from "@/application/cases/repository";
import { toProblemResponse } from "@/application/http/problem";
import { reportStorage } from "@/infrastructure/storage/report-storage";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const report = await getReport(id, user);
    const buffer = await reportStorage.read(report.storagePath);
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${report.reportNumber}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return toProblemResponse(error);
  }
}
