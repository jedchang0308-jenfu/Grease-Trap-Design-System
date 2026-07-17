import { FirebaseError } from "firebase/app";
import { describe, expect, it } from "vitest";
import { AppProblem, toProblem } from "@/application/problem";

describe("browser problem mapping", () => {
  it.each([
    ["auth/operation-not-allowed", "ANONYMOUS_AUTH_DISABLED"],
    ["auth/network-request-failed", "AUTH_NETWORK_ERROR"],
    ["firestore/permission-denied", "FIRESTORE_PERMISSION_DENIED"],
    ["firestore/unavailable", "FIRESTORE_UNAVAILABLE"],
    ["firestore/deadline-exceeded", "FIRESTORE_TIMEOUT"],
  ])("maps %s to %s", (firebaseCode, problemCode) => {
    expect(toProblem(new FirebaseError(firebaseCode, "test"))).toMatchObject({
      code: problemCode,
      retryable: true,
    });
  });

  it("maps Firestore quota errors to a recoverable user action", () => {
    expect(
      toProblem(new FirebaseError("firestore/resource-exhausted", "quota")),
    ).toMatchObject({
      code: "FIRESTORE_QUOTA_EXCEEDED",
      retryable: true,
    });
  });

  it("preserves application problems", () => {
    const problem = new AppProblem({
      code: "STALE_CASE_VERSION",
      title: "共享案件已有新版本",
      userMessage: "請重新載入。",
      retryable: true,
    });
    expect(toProblem(problem)).toEqual(problem.details);
  });
});
