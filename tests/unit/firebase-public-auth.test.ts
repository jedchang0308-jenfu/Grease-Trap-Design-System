import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  createSessionCookie: vi.fn(),
  verifyIdToken: vi.fn(),
  verifySessionCookie: vi.fn(),
}));

vi.mock("firebase-admin/auth", () => ({
  getAuth: () => authMocks,
}));

vi.mock("@/config/env", () => ({
  env: {
    AUTH_BACKEND: "firebase",
    NODE_ENV: "test",
    SESSION_COOKIE_NAME: "__session",
  },
}));

vi.mock("@/infrastructure/firebase/admin", () => ({
  firebaseAdminApp: {},
}));

import { POST } from "@/app/api/auth/session/route";
import { FirebaseAuthAdapter } from "@/infrastructure/auth/firebase-auth";

describe("Firebase public access authentication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a verified anonymous token without role claims", async () => {
    authMocks.verifyIdToken.mockResolvedValue({ uid: "anonymous-user" });

    const user = await new FirebaseAuthAdapter().authenticate(
      new Headers({ authorization: "Bearer anonymous-token" }),
    );

    expect(user).toEqual({
      id: "anonymous-user",
      displayName: "訪客 anonymou",
      roles: ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"],
    });
  });

  it("still rejects an invalid or revoked token", async () => {
    authMocks.verifyIdToken.mockRejectedValue(new Error("invalid token"));

    const user = await new FirebaseAuthAdapter().authenticate(
      new Headers({ authorization: "Bearer invalid-token" }),
    );

    expect(user).toBeNull();
  });

  it("creates a session cookie without requiring role claims", async () => {
    authMocks.verifyIdToken.mockResolvedValue({
      uid: "anonymous-user",
      auth_time: Math.floor(Date.now() / 1000),
    });
    authMocks.createSessionCookie.mockResolvedValue("session-cookie");
    const idToken = "anonymous-token".repeat(10);

    const response = await POST(
      new Request("https://example.test/api/auth/session", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: "https://example.test",
        },
        body: JSON.stringify({ idToken }),
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("__session=");
    expect(authMocks.createSessionCookie).toHaveBeenCalledWith(idToken, {
      expiresIn: 432_000_000,
    });
  });
});
