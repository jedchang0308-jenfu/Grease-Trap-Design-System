import { randomUUID } from "node:crypto";
import { AppProblem } from "@/application/http/problem";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { mutateCase } from "./repository";

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
        issued_by: null,
        issued_by_name: null,
        created_at: now,
        updated_at: now,
        calculations: [],
        assessments: [],
        overrides: [],
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
