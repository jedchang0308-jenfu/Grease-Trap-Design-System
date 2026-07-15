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
    inputs: {
      currentInputs: {
        kind: "DINERS",
        diningType: "CHINESE",
        people: "100",
        greaseCleaningDays: "7",
        sedimentCleaningDays: "7",
      },
    },
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
        semantics: "內政部給排水規範（附錄 5）計算結果",
        inputHash: "a".repeat(64),
        raw: { qLpm: "29.1667", gKg: "2.01" },
        adopted: { qLpm: "29.2", gKg: "2.1" },
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
            formulaCode: "CUR-DIN-Q",
            expression: "Q=N",
            substitution: "100×50÷600×3.5",
            result: "29.1667",
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
    expect(html).toContain("本次只完成一份計算依據");
    expect(html).toContain("內政部給排水規範（附錄 5）");
    expect(html).toContain("臺北市工務局衛工處設計說明");
    expect(html).toContain("未完成");
    expect(html).toContain("設計處理水量");
    expect(html).toContain("本次輸入條件");
    expect(html).toContain("本次設計結果");
    expect(html).toContain("本案條件");
    expect(html).toContain("計算依據參數");
    expect(html).toContain("每日用餐人數");
    expect(html).toContain("100");
    expect(html).toContain("人/日");
    expect(html).toContain("油脂清除週期");
    expect(html).toContain("未完成");
    expect(html).toContain("此依據無法計算");
    expect(html).toContain("完整計算過程");
    expect(html).toContain("計算設計處理水量（尖峰每分鐘）");
    expect(html).toContain("公式");
    expect(html).toContain("代入內容");
    expect(html).toContain("數值算式");
    expect(html).toContain("每人用水量");
    expect(html).toContain("29.1667 L/min");
    expect(html).toContain("統一比對值");
    expect(html).toContain("清除週期油脂量使用 kg");
    expect(html).not.toContain("kg/day");
    expect(html).not.toContain("給客戶的設計需求摘要");
    expect(html).not.toContain("設計需求摘要");
    expect(html).not.toContain("本次結果");
    expect(html).not.toContain("給客戶的重點");
    expect(html).not.toContain("下一步");
    expect(html).not.toContain("本報告提供設計需求數值");
    expect(html).not.toContain("演算法");
    expect(html).not.toContain(
      "以下依實際使用的資料，列出每一個公式、代入數值與計算結果",
    );
    expect(html).not.toContain("讀法");
    expect(html).not.toContain("<dd>DUAL_COMPARISON</dd>");
    expect(html).not.toContain("計算依據與追溯資料");
    expect(html).not.toContain("人工採用與覆核");
    expect(html).not.toContain("版本與責任");
    expect(html).not.toContain("文件狀態與工程責任");
    expect(html).not.toContain("人工採用與例外");
    expect(html).not.toContain("覆核決策");
    expect(html).not.toContain("本報告未執行特定產品或證書符合性判定");
    expect(html).not.toContain("欄位：qLpm");
    expect(html).not.toContain("checksum");
    expect(html).not.toContain("Snapshot schema");
    expect(html).not.toContain("相符型號");
    expect(html).not.toContain("matchedProduct");
  });

  it("renders the full calculation process for each completed method", () => {
    const data = snapshot();
    data.inputs = {
      ...(data.inputs as Record<string, unknown>),
      legacyInputs: {
        kind: "DINERS",
        people: "100",
        qLitersPerPersonMeal: "30",
        operationHours: "5",
        safetyClass: "A",
        safetyFactor: "1.5",
        selectionReason: "依來源 A 類餐飲條件採用。",
        aggregation: "SINGLE_PERIOD",
      },
    };
    data.runs.push({
      id: "legacy-run",
      track: "LEGACY_QV",
      methodCode: "LEGACY_BY_DINERS",
      semantics: "臺北市工務局衛工處設計說明計算結果：有效容積 Veff",
      inputHash: "d".repeat(64),
      raw: { qLph: "900", effectiveVolumeL: "150" },
      adopted: { qLph: "900", effectiveVolumeL: "150" },
      ruleSet: {
        code: "RULE-LEGACY-QV",
        version: "1",
        checksum: "e".repeat(64),
        sourceCode: "SRC-LEGACY-FULL",
        sourceTitle:
          "臺北市政府工務局衛生下水道工程處《油脂截留器使用維護及設計說明》",
        sourceHash: "f".repeat(64),
      },
      steps: [
        {
          sequence: 1,
          formulaCode: "LEG-DIN-Q",
          expression: "Qhour=(n×q/t)×k",
          substitution: "100×30÷5×1.5",
          result: "900",
          unit: "L/h",
          sourceRef: "SRC-LEGACY-FULL",
        },
        {
          sequence: 2,
          formulaCode: "LEG-VEFF",
          expression: "Veff=Qhour/6",
          substitution: "900÷6",
          result: "150",
          unit: "L",
          sourceRef: "SRC-LEGACY-FULL",
        },
      ],
      warnings: [],
    });

    const html = renderReportHtml(data);
    expect(html).toContain(
      "計算依據：臺北市政府工務局衛生下水道工程處《油脂截留器使用維護及設計說明》",
    );
    expect(html).toContain("計算設計處理水量（每小時）");
    expect(html).toContain("計算設備所需有效容積");
    expect(html).toContain("900÷6");
    expect(html).toContain("15 L/min");
    expect(html).not.toContain("原始設計處理水量");
    expect(html).toContain("900");
    expect(html).toContain("L/h");
    expect(html).toContain("單餐期用餐人數");
    expect(html).toContain("每人每餐用水量 q");
    expect(html).toContain("設備所需有效容積");
    expect(html).toContain("此依據無法計算");
    expect(html).toContain(">計算結果</span><strong>150 L</strong>");
  });
});
