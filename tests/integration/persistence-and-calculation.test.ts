import { describe, expect, it, beforeAll } from "vitest";
import { calculateCase } from "@/application/cases/calculation-service";
import {
  createCase,
  deleteCaseGroup,
  getLatestCase,
  getReport,
  listCases,
} from "@/application/cases/repository";
import { createRevision } from "@/application/cases/revision-service";
import {
  issueReport,
  previewReport,
} from "@/application/reports/report-service";
import {
  currentRuleChecksum,
  legacyRuleChecksum,
  ruleCatalog,
} from "@/domain/rules/catalog";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import { resetMemoryCaseStore } from "@/infrastructure/data/memory-case-store";
import { reportStorage } from "@/infrastructure/storage/report-storage";

const actor: AuthenticatedUser = {
  id: "integration-engineer",
  displayName: "整合測試工程使用者",
  roles: ["ENGINEER", "RULE_ADMIN", "SYSTEM_ADMIN"],
};

let caseGroupId: string;
let issuedStoragePath: string;

describe.sequential(
  "memory persistence and server calculation contract",
  () => {
    beforeAll(async () => {
      resetMemoryCaseStore();
      const created = await createCase(
        {
          customer: "QA 客戶",
          location: "QA 地點",
          title: "[TEST] Firebase aggregate",
          purpose: "驗證 server-side 計算與狀態",
          taskCode: "T02_DINERS_TO_DESIGN",
          mode: "DUAL_COMPARISON",
        },
        actor,
      );
      caseGroupId = created.case_group_id;
    });

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

    it("uses the exact versioned rule checksums from source control", () => {
      expect(ruleCatalog.CURRENT_QG.checksum).toBe(currentRuleChecksum);
      expect(ruleCatalog.LEGACY_QV.checksum).toBe(legacyRuleChecksum);
    });

    it("persists one successful track and one non-blocking assessment", async () => {
      const result = await calculateCase(request(), actor);
      expect(result).toMatchObject({
        status: "COMPLETE_WITH_REMINDER",
        releaseEligible: true,
        caseVersion: 2,
      });
      const record = await getLatestCase(caseGroupId, actor);
      expect(record.calculations).toHaveLength(1);
      expect(record.assessments).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            track: "CURRENT_QG",
            status: "CALCULATED",
          }),
          expect.objectContaining({
            track: "LEGACY_QV",
            status: "INSUFFICIENT_DATA",
          }),
        ]),
      );
    });

    it("returns the cached response for an identical idempotency key", async () => {
      const first = await calculateCase(request(), actor);
      const second = await calculateCase(request(), actor);
      expect(second).toEqual(first);
      expect(
        (await getLatestCase(caseGroupId, actor)).calculations,
      ).toHaveLength(1);
    });

    it("shares cases with another authorized engineer", async () => {
      const colleague: AuthenticatedUser = {
        id: "integration-colleague",
        displayName: "共同作業工程使用者",
        roles: ["ENGINEER"],
      };
      await expect(
        getLatestCase(caseGroupId, colleague),
      ).resolves.toMatchObject({
        case_group_id: caseGroupId,
      });
      await expect(
        listCases(colleague, { search: "", mode: "", status: "" }),
      ).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({ case_group_id: caseGroupId }),
        ]),
      );
    });

    it("rejects changed payloads and stale optimistic versions", async () => {
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
      await expect(
        calculateCase(
          { ...request(), idempotencyKey: `stale-${caseGroupId}` },
          actor,
        ),
      ).rejects.toMatchObject({
        details: { code: "STALE_CASE_VERSION", status: 409 },
      });
    });

    it("previews, issues, and downloads the same snapshot", async () => {
      const draft = await previewReport(caseGroupId, actor);
      expect(draft.snapshot.case.lifecycleStatus).toBe("CALCULATED");

      const issued = await issueReport(caseGroupId, actor);
      const persisted = await getReport(issued.id, actor);
      issuedStoragePath = persisted.storagePath;
      expect(issued.status).toBe("ISSUED");
      expect(persisted.snapshot.case.lifecycleStatus).toBe("ISSUED");
      expect(issued.reportNumber).toMatch(/^RDR-[0-9A-HJKMNP-TV-Z]{26}$/);
      expect(persisted.snapshotHash).toBe(issued.snapshotHash);
      expect(
        (await reportStorage.read(persisted.storagePath)).length,
      ).toBeGreaterThan(20_000);

      const retry = await issueReport(caseGroupId, actor);
      expect(retry.id).toBe(issued.id);
    }, 30_000);

    it("keeps issued revisions read-only and creates a clean next revision", async () => {
      const issued = await getLatestCase(caseGroupId, actor);
      await expect(
        calculateCase(
          {
            ...request(),
            revisionNo: issued.revision_no,
            expectedCaseVersion: issued.version,
            idempotencyKey: `issued-${caseGroupId}`,
          },
          actor,
        ),
      ).rejects.toMatchObject({ details: { code: "CASE_READ_ONLY" } });

      const revision = await createRevision(caseGroupId, actor);
      expect(revision).toMatchObject({
        revisionNo: 2,
        lifecycleStatus: "DRAFT",
        caseVersion: 1,
      });
      const next = await getLatestCase(caseGroupId, actor);
      expect(next.calculations).toEqual([]);
      expect(next.input_payload).toEqual({});
    });

    it("hard-deletes the case aggregate", async () => {
      await expect(deleteCaseGroup(caseGroupId, actor)).resolves.toMatchObject({
        deletedRevisionCount: 2,
      });
      await expect(getLatestCase(caseGroupId, actor)).rejects.toMatchObject({
        details: { code: "CASE_NOT_FOUND", status: 404 },
      });
      await expect(reportStorage.read(issuedStoragePath)).rejects.toMatchObject(
        {
          code: "ENOENT",
        },
      );
    });
  },
);
