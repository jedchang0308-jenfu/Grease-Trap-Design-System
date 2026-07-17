import { describe, expect, it } from "vitest";
import { toProblemResponse } from "@/application/http/problem";

describe("toProblemResponse", () => {
  it("preserves structured AppProblem details across module reload boundaries", async () => {
    const response = toProblemResponse({
      details: {
        code: "CASE_NOT_FOUND",
        title: "找不到案件",
        userMessage: "找不到這筆案件，請返回案件清單。",
        status: 404,
      },
    });

    expect(response.status).toBe(404);
    expect(response.headers.get("content-type")).toContain(
      "application/problem+json",
    );
    await expect(response.json()).resolves.toMatchObject({
      code: "CASE_NOT_FOUND",
      status: 404,
    });
  });
});
