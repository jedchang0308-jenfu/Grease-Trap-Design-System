import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import { presentRuleSets } from "@/domain/rules/catalog";

export async function GET(request: Request) {
  try {
    await requireUser(request.headers);
    return NextResponse.json({ items: presentRuleSets() });
  } catch (error) {
    return toProblemResponse(error);
  }
}
