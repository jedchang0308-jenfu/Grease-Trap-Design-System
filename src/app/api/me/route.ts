import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";

export async function GET(request: Request) {
  try {
    const user = await requireUser(request.headers);
    return NextResponse.json(user);
  } catch (error) {
    return toProblemResponse(error);
  }
}
