import { env } from "@/config/env";
import { query } from "@/infrastructure/db/pool";
import type { AuthenticatedUser, AuthPort, Role } from "./auth-port";

interface UserRow {
  id: string;
  display_name: string;
  status: string;
  roles: Role[] | null;
}

export class LocalSeedAuthAdapter implements AuthPort {
  async authenticate(headers: Headers): Promise<AuthenticatedUser | null> {
    if (
      !env.LOCAL_SEED_AUTH ||
      headers.get("x-gtc-disable-seed-auth") === "1"
    ) {
      return null;
    }

    const localUserId =
      headers.get("x-gtc-local-user-id") ?? env.LOCAL_SEED_USER_ID;
    const result = await query<UserRow>(
      `SELECT u.id, u.display_name, u.status,
              COALESCE(array_agg(ur.role) FILTER (WHERE ur.role IS NOT NULL), '{}') AS roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.id = $1
        GROUP BY u.id`,
      [localUserId],
    );

    const user = result.rows[0];
    if (!user || user.status !== "ACTIVE") return null;

    return {
      id: user.id,
      displayName: user.display_name,
      roles: user.roles ?? [],
    };
  }
}

export const authPort: AuthPort = new LocalSeedAuthAdapter();
