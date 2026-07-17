import { beforeEach, describe, expect, it, vi } from "vitest";

const authenticate = vi.hoisted(() => vi.fn());

vi.mock("@/infrastructure/auth", () => ({
  authPort: { authenticate },
}));

import { GET } from "@/app/api/auth/status/route";

describe("auth status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with an unauthenticated status instead of a console-noisy 401", async () => {
    authenticate.mockResolvedValue(null);

    const response = await GET(
      new Request("https://example.test/api/auth/status"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ authenticated: false });
  });

  it("reports an authenticated session", async () => {
    authenticate.mockResolvedValue({ id: "anonymous-user" });

    const response = await GET(
      new Request("https://example.test/api/auth/status"),
    );

    await expect(response.json()).resolves.toEqual({ authenticated: true });
  });
});
