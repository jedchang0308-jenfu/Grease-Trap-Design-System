import { readFile } from "node:fs/promises";
import path from "node:path";
import { requireUser } from "@/application/auth/require-user";
import { getLatestCase } from "@/application/cases/repository";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { pool } from "@/infrastructure/db/pool";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const client = await pool.connect();
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    const result = await client.query<{
      pdf_path: string | null;
      report_number: string;
      case_group_id: string;
    }>(
      `SELECT rs.pdf_path, rs.report_number, c.case_group_id
         FROM report_snapshots rs JOIN calculation_cases c ON c.id=rs.case_revision_id
        WHERE rs.id=$1 AND rs.status='ISSUED'`,
      [id],
    );
    const report = result.rows[0];
    if (!report?.pdf_path)
      throw new AppProblem({
        code: "REPORT_NOT_FOUND",
        title: "找不到報告",
        userMessage: "找不到可下載的已核發報告，請返回案件查看紀錄。",
        status: 404,
      });
    await getLatestCase(client, report.case_group_id, user);
    const buffer = await readFile(path.resolve(report.pdf_path));
    return new Response(new Uint8Array(buffer), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="${report.report_number}.pdf"`,
        "cache-control": "private, no-store",
      },
    });
  } catch (error) {
    return toProblemResponse(error);
  } finally {
    client.release();
  }
}
