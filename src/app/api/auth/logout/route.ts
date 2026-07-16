import { NextResponse } from "next/server";
import { env } from "@/config/env";

export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(env.SESSION_COOKIE_NAME, "", {
    expires: new Date(0),
    httpOnly: true,
    secure: env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  return response;
}
