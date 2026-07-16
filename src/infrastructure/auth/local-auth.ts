import { env } from "@/config/env";
import type { AuthPort, Role } from "./auth-port";

export class LocalSeedAuthAdapter implements AuthPort {
  async authenticate(headers: Headers) {
    if (headers.get("x-gtc-disable-seed-auth") === "1") return null;
    return {
      id: headers.get("x-gtc-local-user-id") ?? env.LOCAL_SEED_USER_ID,
      displayName: env.LOCAL_SEED_USER_NAME,
      roles: ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"] as Role[],
    };
  }
}
