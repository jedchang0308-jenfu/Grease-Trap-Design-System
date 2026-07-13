export const roles = ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"] as const;
export type Role = (typeof roles)[number];

export interface AuthenticatedUser {
  id: string;
  displayName: string;
  roles: Role[];
}

export interface AuthPort {
  authenticate(headers: Headers): Promise<AuthenticatedUser | null>;
}
