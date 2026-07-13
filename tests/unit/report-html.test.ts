import { describe, expect, it } from "vitest";
import { renderReportHtml } from "@/domain/report/html";
import type { ReportSnapshotData } from "@/domain/report/types";

function snapshot(): ReportSnapshotData {
  return {
    schemaVersion: "1.0",
    reportNumber: "DRAFT-01TEST",
    case: {
      id: "1",
      caseGroupId: "2",
      caseNo: "TEST-1",
      revisionNo: 1,
      customer: "QA",
      location: "TW",
      title: "單軌完成",
      purpose: "QA",
      taskCode: "T02_DINERS_TO_DESIGN",
      mode: "DUAL_COMPARISON",
      lifecycleStatus: "REVIEWED",
      calculationStatus: "COMPLETE_WITH_REMINDER",
    },
    inputs: {},
    assessments: [
      {
        track: "CURRENT_QG",
        status: "CALCULATED",
        missingFields: [],
        errors: [],
        releaseRelevance: "有效",
      },
      {
        track: "LEGACY_QV",
        status: "INSUFFICIENT_DATA",
        missingFields: ["legacyInputs"],
        errors: [],
        releaseRelevance: "未計算",
      },
    ],
    runs: [
      {
        id: "run",
        track: "CURRENT_QG",
        methodCode: "CURRENT_BY_DINERS",
        semantics: "現行設計需求 Q/G",
        inputHash: "a".repeat(64),
        raw: { qLpm: "1.01", gKg: "2.01" },
        adopted: { qLpm: "1.1", gKg: "2.1" },
        ruleSet: {
          code: "RULE-CURRENT-QG",
          version: "1",
          checksum: "b".repeat(64),
          sourceCode: "SRC",
          sourceTitle: "官方來源",
          sourceHash: "c".repeat(64),
        },
        steps: [
          {
            sequence: 1,
            formulaCode: "Q",
            expression: "Q=N",
            substitution: "1",
            result: "1.01",
            unit: "L/min",
            sourceRef: "A-37",
          },
        ],
        warnings: [],
      },
    ],
    overrides: [],
    review: {
      preparedBy: "同一人",
      reviewedBy: "同一人",
      checklist: {},
      decision: "APPROVED",
      note: "",
      reviewedAt: "2026-07-13",
    },
    actors: { preparedBy: "同一人", reviewedBy: "同一人", issuedBy: "同一人" },
    limitation: "本報告未執行特定產品或證書符合性判定。",
  };
}

describe("report snapshot HTML", () => {
  it("renders a dual single-track report without fake values", () => {
    const html = renderReportHtml(snapshot());
    expect(html).toContain("雙軌案件 - 單軌完成");
    expect(html).toContain("舊版 Q/V");
    expect(html).toContain("未計算");
    expect(html).toContain("本報告未執行特定產品或證書符合性判定。");
    expect(html).not.toContain("相符型號");
    expect(html).not.toContain("matchedProduct");
  });
});
