import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import {
  createCase,
  listCases,
  presentCase,
} from "@/application/cases/repository";
import { createCaseSchema } from "@/application/cases/schemas";

export async function POST(request: Request) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const parsed = createCaseSchema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppProblem({
        code: "INVALID_CASE",
        title: "案件資料不完整",
        userMessage: "請修正標示欄位後再建立案件；已填資料已保留。",
        status: 400,
        fieldErrors: parsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      });
    }
    const item = await createCase(parsed.data, user);
    return NextResponse.json(presentCase(item), { status: 201 });
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    const url = new URL(request.url);
    const records = await listCases(user, {
      search: url.searchParams.get("search")?.trim() ?? "",
      mode: url.searchParams.get("mode")?.trim() ?? "",
      status: url.searchParams.get("status")?.trim() ?? "",
    });
    const items = records.map((record) => ({
      id: record.id,
      caseId: record.case_group_id,
      caseNo: record.case_no,
      revisionNo: record.revision_no,
      customer: record.customer,
      location: record.location,
      title: record.title,
      taskCode: record.task_code,
      mode: record.mode,
      lifecycleStatus: record.lifecycle_status,
      calculationStatus: record.calculation_status,
      updatedAt: record.updated_at,
      version: record.version,
    }));
    return NextResponse.json({ items, total: items.length });
  } catch (error) {
    return toProblemResponse(error);
  }
}
