import { getAuth } from "firebase-admin/auth";
import { NextResponse } from "next/server";
import { z } from "zod";
import { AppProblem, toProblemResponse } from "@/application/http/problem";
import { env } from "@/config/env";
import { roles, type Role } from "@/infrastructure/auth/auth-port";
import { firebaseAdminApp } from "@/infrastructure/firebase/admin";

const schema = z.object({ idToken: z.string().min(100) });
const expiresIn = 5 * 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    if (env.AUTH_BACKEND !== "firebase") {
      throw new AppProblem({
        code: "FIREBASE_AUTH_DISABLED",
        title: "本機登入未啟用",
        userMessage: "本機開發模式已自動登入，不需建立 Firebase session。",
        status: 409,
      });
    }
    const origin = request.headers.get("origin");
    if (!origin || origin !== new URL(request.url).origin) {
      throw new AppProblem({
        code: "INVALID_AUTH_ORIGIN",
        title: "登入來源無效",
        userMessage: "登入要求來源不一致，請重新整理登入頁。",
        status: 403,
      });
    }
    const parsed = schema.safeParse(await request.json());
    if (!parsed.success) {
      throw new AppProblem({
        code: "INVALID_ID_TOKEN",
        title: "登入資料無效",
        userMessage: "登入資料已失效，請重新登入。",
        status: 400,
      });
    }
    const auth = getAuth(firebaseAdminApp);
    const decoded = await auth.verifyIdToken(parsed.data.idToken, true);
    if (Date.now() / 1000 - decoded.auth_time > 5 * 60) {
      throw new AppProblem({
        code: "RECENT_LOGIN_REQUIRED",
        title: "請重新登入",
        userMessage: "登入時間已超過安全交換期限，請重新登入。",
        status: 401,
      });
    }
    const claimedRoles = Array.isArray(decoded.roles)
      ? decoded.roles
      : typeof decoded.role === "string"
        ? [decoded.role]
        : [];
    if (
      !claimedRoles.some((role): role is Role => roles.includes(role as Role))
    ) {
      throw new AppProblem({
        code: "ACCOUNT_NOT_PROVISIONED",
        title: "帳號尚未授權",
        userMessage: "此帳號尚未配置系統角色，請聯絡管理者。",
        status: 403,
      });
    }
    const sessionCookie = await auth.createSessionCookie(parsed.data.idToken, {
      expiresIn,
    });
    const response = NextResponse.json({ ok: true });
    response.cookies.set(env.SESSION_COOKIE_NAME, sessionCookie, {
      maxAge: expiresIn / 1000,
      httpOnly: true,
      secure: env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    });
    return response;
  } catch (error) {
    return toProblemResponse(error);
  }
}
