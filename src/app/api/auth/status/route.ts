import { NextResponse } from "next/server";
import { authPort } from "@/infrastructure/auth";

export async function GET(request: Request) {
  const user = await authPort.authenticate(request.headers);
  return NextResponse.json({ authenticated: Boolean(user) });
}
