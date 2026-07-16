import { AppProblem } from "@/application/http/problem";
import { authPort } from "@/infrastructure/auth";
import type { Role } from "@/infrastructure/auth/auth-port";

export async function requireUser(headers: Headers, requiredRole?: Role) {
  const user = await authPort.authenticate(headers);
  if (!user) {
    throw new AppProblem({
      code: "AUTH_REQUIRED",
      title: "需要登入",
      userMessage: "請先登入內部帳號，再繼續處理案件。",
      status: 401,
      retryable: false,
    });
  }
  if (requiredRole && !user.roles.includes(requiredRole)) {
    throw new AppProblem({
      code: "ROLE_REQUIRED",
      title: "權限不足",
      userMessage: "你沒有執行此動作的權限；請聯絡對應管理角色。",
      status: 403,
      retryable: false,
    });
  }
  return user;
}
