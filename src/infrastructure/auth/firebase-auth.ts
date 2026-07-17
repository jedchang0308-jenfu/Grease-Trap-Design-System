import { getAuth } from "firebase-admin/auth";
import { env } from "@/config/env";
import { firebaseAdminApp } from "@/infrastructure/firebase/admin";
import { roles, type AuthPort } from "./auth-port";

function readCookie(cookieHeader: string | null, name: string) {
  if (!cookieHeader) return null;
  for (const cookie of cookieHeader.split(";")) {
    const [key, ...value] = cookie.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return null;
}

export class FirebaseAuthAdapter implements AuthPort {
  async authenticate(headers: Headers) {
    const bearer = headers.get("authorization")?.match(/^Bearer\s+(.+)$/i)?.[1];
    const session = readCookie(headers.get("cookie"), env.SESSION_COOKIE_NAME);
    if (!bearer && !session) return null;

    try {
      const auth = getAuth(firebaseAdminApp);
      const token = bearer
        ? await auth.verifyIdToken(bearer, true)
        : await auth.verifySessionCookie(session!, true);
      return {
        id: token.uid,
        displayName:
          token.name || token.email || `訪客 ${token.uid.slice(0, 8)}`,
        roles: [...roles],
      };
    } catch {
      return null;
    }
  }
}
