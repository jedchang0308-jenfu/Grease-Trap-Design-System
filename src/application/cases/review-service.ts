import { randomUUID } from "node:crypto";
import { AppProblem } from "@/application/http/problem";
import { sha256 } from "@/domain/shared/canonical";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { withTransaction } from "@/infrastructure/db/pool";
import { getLatestCase } from "./repository";

export async function submitForReview(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  return withTransaction(async (client) => {
    const row = await getLatestCase(client, caseGroupId, user, true);
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
    await client.query(
      "UPDATE calculation_cases SET lifecycle_status='IN_REVIEW', version=version+1, updated_at=now() WHERE id=$1",
      [row.id],
    );
    await client.query(
      "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, metadata_json) VALUES($1,'SUBMITTED_FOR_REVIEW','CASE',$2,$3)",
      [user.id, row.id, { actorCanSelfReview: true }],
    );
    return {
      caseId: caseGroupId,
      lifecycleStatus: "IN_REVIEW",
      caseVersion: row.version + 1,
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
  return withTransaction(async (client) => {
    const row = await getLatestCase(client, caseGroupId, user, true);
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
    const status = input.decision === "APPROVED" ? "REVIEWED" : "CALCULATED";
    await client.query(
      "INSERT INTO review_records(id, case_revision_id, prepared_by, reviewed_by, checklist_json, decision, note) VALUES($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        row.id,
        row.prepared_by ?? row.created_by,
        user.id,
        checklist,
        input.decision,
        input.note ?? "",
      ],
    );
    await client.query(
      "UPDATE calculation_cases SET lifecycle_status=$2, reviewed_by=$3, version=version+1, updated_at=now() WHERE id=$1",
      [row.id, status, input.decision === "APPROVED" ? user.id : null],
    );
    await client.query(
      "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, after_hash, metadata_json) VALUES($1,$2,'CASE',$3,$4,$5)",
      [
        user.id,
        input.decision === "APPROVED" ? "REVIEW_COMPLETED" : "REVIEW_RETURNED",
        row.id,
        sha256({ checklist, note: input.note }),
        { checklist, note: input.note ?? "" },
      ],
    );
    return {
      caseId: caseGroupId,
      lifecycleStatus: status,
      caseVersion: row.version + 1,
    };
  });
}

export async function createRevision(
  caseGroupId: string,
  user: AuthenticatedUser,
) {
  return withTransaction(async (client) => {
    const row = await getLatestCase(client, caseGroupId, user, true);
    if (row.lifecycle_status !== "ISSUED") {
      throw new AppProblem({
        code: "REVISION_REQUIRES_ISSUED_CASE",
        title: "目前不需建立修訂",
        userMessage: "只有已核發版本需要建立新修訂；目前版本可直接編輯。",
        status: 409,
      });
    }
    const id = randomUUID();
    const revision = row.revision_no + 1;
    await client.query(
      `INSERT INTO calculation_cases(
         id, case_group_id, case_no, revision_no, customer, location, title, purpose, dining_type,
         task_code, mode, lifecycle_status, created_by
       ) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,'DRAFT',$12)`,
      [
        id,
        row.case_group_id,
        row.case_no,
        revision,
        row.customer,
        row.location,
        row.title,
        row.purpose,
        row.dining_type,
        row.task_code,
        row.mode,
        user.id,
      ],
    );
    await client.query(
      "INSERT INTO audit_events(actor_id, action, aggregate_type, aggregate_id, metadata_json) VALUES($1,'REVISION_CREATED','CASE',$2,$3)",
      [user.id, id, { previousRevisionId: row.id, revisionNo: revision }],
    );
    return {
      caseId: caseGroupId,
      revisionNo: revision,
      lifecycleStatus: "DRAFT",
      caseVersion: 1,
    };
  });
}
