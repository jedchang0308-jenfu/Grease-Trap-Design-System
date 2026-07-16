import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { env } from "@/config/env";
import { firebaseAdminApp } from "@/infrastructure/firebase/admin";
import { roles, type AuthPort, type Role } from "./auth-port";

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

function recognizedRoles(token: DecodedIdToken): Role[] {
  const claimed = Array.isArray(token.roles)
    ? token.roles
    : typeof token.role === "string"
      ? [token.role]
      : [];
  return claimed.filter((role): role is Role => roles.includes(role as Role));
}

export class FirebaseAuthAdapter implements AuthPort {
  async authenticate(headers: Headers) {
    const auth = getAuth(firebaseAdminApp);
    const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const session = readCookie(headers.get("cookie"), env.SESSION_COOKIE_NAME);
    if (!bearer && !session) return null;

    try {
      const token = bearer
        ? await auth.verifyIdToken(bearer, true)
        : await auth.verifySessionCookie(session!, true);
      const tokenRoles = recognizedRoles(token);
      if (!tokenRoles.length) return null;
      return {
        id: token.uid,
        displayName: token.name || token.email || token.uid,
        roles: tokenRoles,
      };
    } catch {
      return null;
    }
  }
}
