import { randomUUID } from "node:crypto";
import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { mutateCase } from "./repository";

export async function submitForReview(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  return mutateCase(caseGroupId, user, (row) => {
    if (
      !row.calculation_status ||
      !["COMPLETE", "COMPLETE_WITH_REMINDER"].includes(row.calculation_status)
    ) {
      throw new AppProblem({
        code: "CALCULATION_BLOCKED",
        title: "目前不能提交覆核",
        userMessage: "請先完成至少一個有效計算軌，再提交覆核。",
        status: 409,
      });
    }
    if (row.lifecycle_status !== "CALCULATED") {
      throw new AppProblem({
        code: "INVALID_LIFECYCLE_TRANSITION",
        title: "案件狀態不允許提交",
        userMessage: "請重新載入案件，確認目前狀態後再繼續。",
        status: 409,
      });
    }
    const now = new Date().toISOString();
    return {
      next: {
        ...row,
        lifecycle_status: "IN_REVIEW",
        version: row.version + 1,
        updated_at: now,
      },
      result: {
        caseId: caseGroupId,
        lifecycleStatus: "IN_REVIEW",
        caseVersion: row.version + 1,
      },
    };
  });
}

export async function completeReview(
  caseGroupId: string,
  input: {
    decision: "APPROVED" | "RETURNED";
    checklist?: Record<string, boolean>;
    note?: string;
  },
  user: AuthenticatedUser,
) {
  return mutateCase(caseGroupId, user, (row) => {
    if (row.lifecycle_status !== "IN_REVIEW") {
      throw new AppProblem({
        code: "INVALID_REVIEW_STATE",
        title: "目前不能完成覆核",
        userMessage: "案件不在覆核中，請重新載入。",
        status: 409,
      });
    }
    const checklist = input.checklist ?? {};
    const required = [
      "method",
      "units",
      "sources",
      "limitations",
      "incompleteTracks",
    ];
    if (
      input.decision === "APPROVED" &&
      required.some((key) => checklist[key] !== true)
    ) {
      throw new AppProblem({
        code: "REVIEW_CHECKLIST_INCOMPLETE",
        title: "覆核清單未完成",
        userMessage: "請確認方法、單位、來源、限制與未完成軌標示後再完成覆核。",
        status: 400,
      });
    }
    if (input.decision === "RETURNED" && !input.note?.trim()) {
      throw new AppProblem({
        code: "RETURN_REASON_REQUIRED",
        title: "請填寫退回原因",
        userMessage: "請說明需要修正的內容，讓下一步可被執行。",
        status: 400,
      });
    }
    const lifecycleStatus =
      input.decision === "APPROVED" ? "REVIEWED" : "CALCULATED";
    const now = new Date().toISOString();
    return {
      next: {
        ...row,
        lifecycle_status: lifecycleStatus,
        reviewed_by: input.decision === "APPROVED" ? user.id : null,
        reviewed_by_name:
          input.decision === "APPROVED" ? user.displayName : null,
        review: {
          preparedBy: row.prepared_by_name ?? row.created_by_name,
          reviewedBy: user.displayName,
          checklist,
          decision: input.decision,
          note: input.note ?? "",
          reviewedAt: now,
        },
        version: row.version + 1,
        updated_at: now,
      },
      result: {
        caseId: caseGroupId,
        lifecycleStatus,
        caseVersion: row.version + 1,
      },
    };
  });
}

export async function createRevision(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  return mutateCase(caseGroupId, user, (row) => {
    if (row.lifecycle_status !== "ISSUED") {
      throw new AppProblem({
        code: "REVISION_REQUIRES_ISSUED_CASE",
        title: "目前不需建立修訂",
        userMessage: "只有已核發版本需要建立新修訂；目前版本可直接編輯。",
        status: 409,
      });
    }
    const revisionNo = row.revision_no + 1;
    const now = new Date().toISOString();
    return {
      next: {
        ...row,
        id: randomUUID(),
        revision_no: revisionNo,
        lifecycle_status: "DRAFT",
        calculation_status: null,
        input_payload: {},
        version: 1,
        created_by: user.id,
        created_by_name: user.displayName,
        prepared_by: null,
        prepared_by_name: null,
        reviewed_by: null,
        reviewed_by_name: null,
        issued_by: null,
        issued_by_name: null,
        created_at: now,
        updated_at: now,
        calculations: [],
        assessments: [],
        overrides: [],
        review: null,
        reports: [],
        latestReportId: null,
        calculationRequests: {},
      },
      result: {
        caseId: caseGroupId,
        revisionNo,
        lifecycleStatus: "DRAFT",
        caseVersion: 1,
      },
    };
  });
}
