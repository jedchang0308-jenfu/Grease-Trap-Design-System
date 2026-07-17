import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import type { ReportSnapshotData } from "@/domain/report/types";
import type { AuthenticatedUser } from "@/infrastructure/auth/auth-port";
import type {
  CaseRecord,
  ReportRecord,
} from "@/infrastructure/data/case-store";
import { LocalFileCaseStore } from "@/infrastructure/data/local-file-case-store";

const actor: AuthenticatedUser = {
  id: "local-file-engineer",
  displayName: "本機檔案測試工程師",
  roles: ["ENGINEER"],
};

let tempRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    tempRoots.map((root) => rm(root, { recursive: true, force: true })),
  );
  tempRoots = [];
});

async function makeStorePath() {
  const root = await mkdtemp(path.join(tmpdir(), "gtc-local-store-"));
  tempRoots.push(root);
  return path.join(root, "case-store.json");
}

function makeCaseRecord(overrides: Partial<CaseRecord> = {}): CaseRecord {
  const now = "2026-07-17T00:00:00.000Z";
  const caseGroupId = overrides.case_group_id ?? "case-local-file-1";
  return {
    id: "revision-local-file-1",
    case_group_id: caseGroupId,
    case_no: "GTC-20260717-000001",
    revision_no: 1,
    customer: "本機客戶",
    location: "本機地點",
    title: "本機持久化測試",
    purpose: "驗證重啟後仍可讀取案件",
    dining_type: null,
    task_code: "T02_DINERS_TO_DESIGN",
    mode: "DUAL_COMPARISON",
    lifecycle_status: "DRAFT",
    calculation_status: null,
    input_payload: {},
    version: 1,
    created_by: actor.id,
    created_by_name: actor.displayName,
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
    ...overrides,
  };
}

function makeReport(record: CaseRecord): ReportRecord {
  const reportNumber = "RDR-LOCAL-FILE";
  const snapshot: ReportSnapshotData = {
    schemaVersion: "1.0",
    reportNumber,
    case: {
      id: record.id,
      caseGroupId: record.case_group_id,
      caseNo: record.case_no,
      revisionNo: record.revision_no,
      customer: record.customer,
      location: record.location,
      title: record.title,
      purpose: record.purpose,
      taskCode: record.task_code,
      mode: record.mode,
      lifecycleStatus: "ISSUED",
      calculationStatus: "COMPLETE",
    },
    inputs: {},
    assessments: [],
    runs: [],
    overrides: [],
    actors: { preparedBy: actor.displayName, issuedBy: actor.displayName },
    limitation: "本報告未執行特定產品或證書符合性判定。",
  };

  return {
    id: "report-local-file-1",
    snapshotHash: "hash-local-file-1",
    reportNumber,
    status: "ISSUED",
    storagePath: "output/pdf/local-file.pdf",
    issuedAt: "2026-07-17T00:01:00.000Z",
    caseGroupId: record.case_group_id,
    revisionNo: record.revision_no,
    snapshot,
    createdBy: actor.id,
    issuedBy: actor.id,
  };
}

describe("LocalFileCaseStore", () => {
  it("persists cases across store instances", async () => {
    const filePath = await makeStorePath();
    const first = new LocalFileCaseStore(filePath);
    const record = makeCaseRecord();

    await first.create(record);
    await first.mutate(record.case_group_id, actor, (current) => {
      const next = {
        ...current,
        title: "重啟後保留的案件",
        version: current.version + 1,
        updated_at: "2026-07-17T00:02:00.000Z",
      };
      return { next, result: next.version };
    });

    const second = new LocalFileCaseStore(filePath);
    await expect(
      second.get(record.case_group_id, actor),
    ).resolves.toMatchObject({
      title: "重啟後保留的案件",
      version: 2,
    });
    await expect(second.list(actor)).resolves.toContainEqual(
      expect.objectContaining({ case_no: record.case_no }),
    );
  });

  it("persists issued report metadata and cascades deletes", async () => {
    const filePath = await makeStorePath();
    const record = makeCaseRecord({
      case_group_id: "case-local-file-2",
      lifecycle_status: "CALCULATED",
      calculation_status: "COMPLETE",
      version: 2,
    });
    const report = makeReport(record);
    const first = new LocalFileCaseStore(filePath);

    await first.create(record);
    await expect(
      first.commitIssuedReport(record.case_group_id, 2, report, actor),
    ).resolves.toMatchObject({ id: report.id });

    const second = new LocalFileCaseStore(filePath);
    await expect(second.getReport(report.id, actor)).resolves.toMatchObject({
      id: report.id,
      snapshotHash: report.snapshotHash,
    });
    await expect(
      second.commitIssuedReport(record.case_group_id, 2, report, actor),
    ).resolves.toMatchObject({ id: report.id });
    await expect(second.delete(record.case_group_id, actor)).resolves.toEqual({
      revisionCount: 1,
      storagePaths: [report.storagePath],
    });

    const third = new LocalFileCaseStore(filePath);
    await expect(third.getReport(report.id, actor)).rejects.toMatchObject({
      details: { code: "REPORT_NOT_FOUND", status: 404 },
    });
  });
});
