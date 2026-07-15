import { randomUUID } from "node:crypto";
import { stat } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { calculateCase } from "@/application/cases/calculation-service";
import {
  completeReview,
  submitForReview,
} from "@/application/cases/review-service";
import {
  issueReport,
  previewReport,
} from "@/application/reports/report-service";
import {
  currentRuleChecksum,
  legacyRuleChecksum,
} from "@/domain/rules/seed-data";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { pool } from "@/infrastructure/db/pool";

const actor: AuthenticatedUser = {
  id: "00000000-0000-4000-8000-000000000001",
  displayName: "本機工程使用者",
  roles: ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"],
};

let caseGroupId: string;
let revisionId: string;

beforeAll(async () => {
  caseGroupId = randomUUID();
  revisionId = randomUUID();
  await pool.query(
    `INSERT INTO calculation_cases(
       id, case_group_id, case_no, revision_no, customer, location, title,
       task_code, mode, lifecycle_status, created_by
     ) VALUES($1,$2,$3,1,'QA 客戶','QA 地點','[TEST] 雙軌交易',
              'T02_DINERS_TO_DESIGN','DUAL_COMPARISON','DRAFT',$4)`,
    [revisionId, caseGroupId, `TEST-${Date.now()}`, actor.id],
  );
});

afterAll(async () => {
  await pool.end();
});

describe("G1 rule database", () => {
  it("has the exact active rule checksums and factor point counts", async () => {
    const rules = await pool.query<{ method_family: string; checksum: string }>(
      "SELECT method_family, checksum FROM rule_sets WHERE status='ACTIVE' ORDER BY method_family",
    );
    expect(rules.rows).toEqual([
      { method_family: "CURRENT_QG", checksum: currentRuleChecksum },
      { method_family: "LEGACY_QV", checksum: legacyRuleChecksum },
    ]);
    const counts = await pool.query<{ table_code: string; count: string }>(
      `SELECT ft.table_code, count(fp.id)::text AS count
         FROM factor_tables ft LEFT JOIN factor_points fp ON fp.table_id=ft.id
        GROUP BY ft.table_code ORDER BY ft.table_code`,
    );
    expect(
      Object.fromEntries(counts.rows.map((row) => [row.table_code, row.count])),
    ).toMatchObject({
      "A-34": "50",
      "A-35": "10",
      "A-36": "171",
      "A-37": "55",
      "LEGACY-K": "5",
      "LEGACY-WATER": "20",
    });
  });

  it("rejects updates to an active rule set", async () => {
    await expect(
      pool.query(
        "UPDATE rule_sets SET effective_from=CURRENT_DATE WHERE status='ACTIVE'",
      ),
    ).rejects.toThrow(/immutable/);
  });
});

describe("G2 transaction and API service contract", () => {
  const request = () => ({
    caseId: caseGroupId,
    revisionNo: 1,
    taskCode: "T02_DINERS_TO_DESIGN" as const,
    mode: "DUAL_COMPARISON" as const,
    idempotencyKey: `integration-${caseGroupId}`,
    expectedCaseVersion: 1,
    currentInputs: {
      kind: "DINERS" as const,
      diningType: "CHINESE" as const,
      people: "1000",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    },
  });

  it("commits one successful track and a non-blocking assessment for the missing track", async () => {
    const result = (await calculateCase(request(), actor)) as {
      status: string;
      releaseEligible: boolean;
      calculationRunIds: string[];
      trackAssessments: Array<{ track: string; status: string }>;
      caseVersion: number;
    };
    expect(result.status).toBe("COMPLETE_WITH_REMINDER");
    expect(result.releaseEligible).toBe(true);
    expect(result.calculationRunIds).toHaveLength(1);
    expect(result.trackAssessments).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ track: "CURRENT_QG", status: "CALCULATED" }),
        expect.objectContaining({
          track: "LEGACY_QV",
          status: "INSUFFICIENT_DATA",
        }),
      ]),
    );
    expect(result.caseVersion).toBe(2);

    const database = await pool.query<{ runs: string; assessments: string }>(
      `SELECT
         (SELECT count(*) FROM calculation_runs WHERE case_revision_id=$1)::text AS runs,
         (SELECT count(*) FROM track_assessments ta JOIN calculation_requests cr ON cr.id=ta.request_id WHERE cr.case_revision_id=$1)::text AS assessments`,
      [revisionId],
    );
    expect(database.rows[0]).toEqual({ runs: "1", assessments: "2" });
  });

  it("returns the same response for the same idempotency key and payload", async () => {
    const second = (await calculateCase(request(), actor)) as {
      calculationRunIds: string[];
    };
    const count = await pool.query<{ count: string }>(
      "SELECT count(*)::text AS count FROM calculation_runs WHERE case_revision_id=$1",
      [revisionId],
    );
    expect(second.calculationRunIds).toHaveLength(1);
    expect(count.rows[0].count).toBe("1");
  });

  it("rejects an idempotency key reused with a different payload", async () => {
    await expect(
      calculateCase(
        {
          ...request(),
          currentInputs: { ...request().currentInputs, people: "1001" },
        },
        actor,
      ),
    ).rejects.toMatchObject({
      details: { code: "IDEMPOTENCY_CONFLICT", status: 409 },
    });
  });

  it("rejects stale optimistic versions before creating another request", async () => {
    await expect(
      calculateCase(
        { ...request(), idempotencyKey: `stale-${caseGroupId}` },
        actor,
      ),
    ).rejects.toMatchObject({
      details: { code: "STALE_CASE_VERSION", status: 409 },
    });
  });

  it("previews the complete draft before the same actor submits final review", async () => {
    const draft = await previewReport(caseGroupId, actor);
    expect(draft.snapshot.case.lifecycleStatus).toBe("CALCULATED");
    expect(draft.snapshot.review.decision).toBe("PENDING");
    expect(draft.html).toContain("本次只完成一種計算方法");

    await submitForReview(caseGroupId, actor);
    const review = await completeReview(
      caseGroupId,
      {
        decision: "APPROVED",
        checklist: {
          method: true,
          units: true,
          sources: true,
          limitations: true,
          incompleteTracks: true,
        },
      },
      actor,
    );
    expect(review.lifecycleStatus).toBe("REVIEWED");
    const events = await pool.query<{ action: string }>(
      "SELECT action FROM audit_events WHERE aggregate_id=$1 AND action IN ('SUBMITTED_FOR_REVIEW','REVIEW_COMPLETED') ORDER BY created_at",
      [revisionId],
    );
    expect(events.rows.map((row) => row.action)).toEqual([
      "SUBMITTED_FOR_REVIEW",
      "REVIEW_COMPLETED",
    ]);
  });

  it("issues an immutable snapshot PDF and returns the same issued record on retry", async () => {
    const first = await issueReport(caseGroupId, actor);
    expect(first.status).toBe("ISSUED");
    expect(first.reportNumber).toMatch(/^DRAFT-[0-9A-HJKMNP-TV-Z]{26}$/);
    const row = await pool.query<{
      pdf_path: string;
      snapshot_json: {
        limitation: string;
        runs: unknown[];
        assessments: unknown[];
      };
      snapshot_hash: string;
    }>(
      "SELECT pdf_path, snapshot_json, snapshot_hash FROM report_snapshots WHERE id=$1",
      [first.id],
    );
    expect(
      (await stat(path.resolve(row.rows[0].pdf_path))).size,
    ).toBeGreaterThan(20_000);
    expect(row.rows[0].snapshot_json.limitation).toBe(
      "本報告未執行特定產品或證書符合性判定。",
    );
    expect(row.rows[0].snapshot_json.runs).toHaveLength(1);
    expect(row.rows[0].snapshot_json.assessments).toHaveLength(2);

    const preview = await previewReport(caseGroupId, actor);
    expect(preview.snapshotHash).toBe(first.snapshotHash);
    expect(preview.html).toContain("本次只完成一種計算方法");
    const second = await issueReport(caseGroupId, actor);
    expect(second.id).toBe(first.id);

    await expect(
      pool.query("UPDATE report_snapshots SET snapshot_hash=$2 WHERE id=$1", [
        first.id,
        "f".repeat(64),
      ]),
    ).rejects.toThrow(/immutable/);
    await expect(
      pool.query(
        "UPDATE calculation_cases SET customer='tampered' WHERE id=$1",
        [revisionId],
      ),
    ).rejects.toThrow(/immutable/);
  });

  it("keeps completed calculation runs immutable", async () => {
    const run = await pool.query<{ id: string }>(
      "SELECT id FROM calculation_runs WHERE case_revision_id=$1 LIMIT 1",
      [revisionId],
    );
    await expect(
      pool.query(
        "UPDATE calculation_runs SET result_semantics='tampered' WHERE id=$1",
        [run.rows[0].id],
      ),
    ).rejects.toThrow(/immutable/);
  });
});
