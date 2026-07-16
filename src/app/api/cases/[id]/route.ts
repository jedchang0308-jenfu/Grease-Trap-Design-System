import { NextResponse } from "next/server";
import { requireUser } from "@/application/auth/require-user";
import { toProblemResponse } from "@/application/http/problem";
import {
  deleteCaseGroup,
  getLatestCase,
  presentCase,
} from "@/application/cases/repository";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers);
    const { id } = await context.params;
    return NextResponse.json(presentCase(await getLatestCase(id, user)));
  } catch (error) {
    return toProblemResponse(error);
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUser(request.headers, "ENGINEER");
    const { id } = await context.params;
    return NextResponse.json(await deleteCaseGroup(id, user));
  } catch (error) {
    return toProblemResponse(error);
  }
}
