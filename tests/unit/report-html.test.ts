import { describe, expect, it } from "vitest";
import { renderReportHtml } from "@/domain/report/html";
import type { ReportSnapshotData } from "@/domain/report/types";

function snapshot(): ReportSnapshotData {
  return {
    schemaVersion: "2.0",
    reportNumber: "GTC-260914-02",
    case: {
      id: "1",
      caseGroupId: "2",
      caseNo: "GTC-260914-02",
      revisionNo: 1,
      customer: "QA",
      location: "TW",
      title: "單軌完成",
      purpose: "QA",
      taskCode: "T02_DINERS_TO_DESIGN",
      mode: "DUAL_COMPARISON",
      lifecycleStatus: "ISSUED",
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
    actors: { preparedBy: "同一人", exportedBy: "同一人" },
  };
}

describe("report snapshot HTML", () => {
  it("renders a formal report using the case number and revision", () => {
    const data = snapshot();
    const html = renderReportHtml(data, "FORMAL");

    expect(html).toContain("油脂截留器設計計算報告");
    expect(html).not.toContain("油脂截留器設計計算報告草稿");
    expect(html).toContain("報告編號：GTC-260914-02");
    expect(html).toContain("版次：修訂 1");
    expect(html).toContain("正式報告");
    expect(html).not.toContain("文件狀態：草稿");
    expect(html).not.toContain("不代表公司身分驗證或公司簽核效力");
    expect(html).toContain('<dl class="summary-list">');
    expect(html).toContain("<dt>需求目的</dt>");
    expect(html).toContain("<dt>計算依據</dt>");
    expect(html).not.toContain('class="summary-table"');
  });

  it("keeps unavailable case metadata in the compact summary", () => {
    const data = snapshot();
    data.case.customer = "未提供";
    data.case.location = "未提供";

    const html = renderReportHtml(data);

    expect(html).toContain("<dt>客戶</dt>");
    expect(html).toContain("<dt>設置地點</dt>");
    expect(html).toContain("未提供");
  });

  it("renders formula symbols with subscripts", () => {
    const data = snapshot();
    data.runs[0].steps = [
      {
        sequence: 1,
        formulaCode: "LEG-VOL-QH",
        expression: "Qhour=6×Veff",
        substitution: "6×500",
        result: "3000",
        unit: "L/h",
        sourceRef: "SRC-LEGACY-FULL",
      },
      {
        sequence: 2,
        formulaCode: "LEG-VOL-QM",
        expression: "Qminute=Qhour/60",
        substitution: "3000÷60",
        result: "50",
        unit: "L/min",
        sourceRef: "unit-conversion",
      },
    ];

    const html = renderReportHtml(data);

    expect(html).toContain("Q<sub>hour</sub>=6×V<sub>eff</sub>");
    expect(html).toContain("Q<sub>minute</sub>=Q<sub>hour</sub>/60");
    expect(html).toContain('<td class="symbol">Q<sub>hour</sub>');
    expect(html).not.toContain("Qminute=Qhour/60");
  });

  it("renders a dual single-track report without fake values", () => {
    const html = renderReportHtml(snapshot());
    expect(html).toContain("文件狀態：草稿");
    expect(html).not.toContain("本文件為瀏覽器產生的報告草稿");
    expect(html).not.toContain('class="screen-footer-page"');
    expect(html).not.toContain("草稿編號：TBD");
    expect(html).not.toContain("GTC-260914-02 - 油脂截留器設計計算報告草稿");
    expect(html).toContain(
      '<link rel="stylesheet" href="/report-fonts/report-font.css"',
    );
    expect(html).toContain('font-family: "Jenfu Report Sans", sans-serif');
    expect(html).toContain("print-color-adjust: exact");
    expect(html).toContain("thead { display: table-header-group; }");
    expect(html).toContain("orphans: 3; widows: 3;");
    expect(html).not.toContain("Microsoft JhengHei");
    expect(html).not.toContain("Consolas");
    expect(html).toContain(
      'content: "頁次 " counter(page) "/" counter(pages);',
    );
    expect(html).toContain("本次只完成一份計算依據");
    expect(html).toContain("<h2>1 案件資料</h2>");
    expect(html).toContain("<h2>2 本次輸入條件</h2>");
    expect(html).toContain("<h3>2.1 算法B-內政部給排水規範（附錄 5）</h3>");
    expect(html).toContain("<h2>3 本次設計結果</h2>");
    expect(html).toContain("<h2>4 完整計算過程</h2>");
    expect(html).toContain("<h3>4.1 計算依據：");
    expect(html).toContain(
      '<h4 class="step-purpose">4.1.1 計算設計處理水量（尖峰每分鐘）</h4>',
    );
    expect(html).toContain("算法B-內政部給排水規範（附錄 5）");
    expect(html).toContain("算法A-臺北市工務局衛工處設計說明");
    expect(html).toContain("未完成");
    expect(html).toContain("設計處理水量");
    expect(html).toContain("本次輸入條件");
    expect(html).toContain("本次設計結果");
    expect(html).toContain("本案條件");
    expect(html).toContain("計算依據參數");
    expect(html).not.toContain('<td class="number-cell"><strong>100</strong>');
    expect(html).not.toContain(
      '<p class="result-guide"><strong>下表顯示本次採用值。</strong>',
    );
    expect(html).not.toContain(
      'class="step-comparison"><span class="step-label">換算值</span><strong>',
    );
    expect(html).toContain(
      '<p class="step-line step-result"><span class="step-label">計算結果</span><strong>',
    );
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
    expect(html).toContain("換算值");
    expect(html).not.toContain("未取整");
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
    expect(html).not.toContain("內部責任流程");
    expect(html).not.toContain("版本與責任");
    expect(html).not.toContain("文件狀態與工程責任");
    expect(html).not.toContain("人工採用與例外");
    expect(html).not.toContain("內部決策紀錄");
    expect(html).not.toContain("本報告未執行特定產品或證書符合性判定");
    expect(html).not.toContain("欄位：qLpm");
    expect(html).not.toContain("checksum");
    expect(html).not.toContain("Snapshot schema");
    expect(html).not.toContain("相符型號");
    expect(html).not.toContain("matchedProduct");
    expect(html).not.toContain("頁次 -- / --");
  });

  it("renders the full calculation process for each completed method", () => {
    const data = snapshot();
    data.inputs = {
      ...(data.inputs as Record<string, unknown>),
      legacyInputs: {
        kind: "DINERS",
        people: "95",
        qLitersPerPersonMeal: "30",
        operationHours: "4",
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
      raw: { qLph: "1068.75", effectiveVolumeL: "178.125" },
      adopted: { qLph: "1068.8", effectiveVolumeL: "178.2" },
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
          substitution: "95×30÷4×1.5",
          result: "1068.75",
          unit: "L/h",
          sourceRef: "SRC-LEGACY-FULL",
        },
        {
          sequence: 2,
          formulaCode: "LEG-VEFF",
          expression: "Veff=Qhour/6",
          substitution: "1068.75÷6",
          result: "178.125",
          unit: "L",
          sourceRef: "SRC-LEGACY-FULL",
        },
      ],
      warnings: [],
    });

    const html = renderReportHtml(data);
    expect(html).toContain("<h3>2.2 算法A-臺北市工務局衛工處設計說明</h3>");
    expect(html).toContain("<h3>4.2 計算依據：");
    expect(html).toContain(
      '<h4 class="step-purpose">4.2.2 計算設備所需有效容積</h4>',
    );
    expect(html).toContain(
      "計算依據：臺北市政府工務局衛生下水道工程處《油脂截留器使用維護及設計說明》",
    );
    expect(html).toContain("計算設計處理水量（每小時）");
    expect(html).toContain("計算設備所需有效容積");
    expect(html).toContain("1068.75÷6");
    expect(html).toContain("下表顯示本次採用值");
    expect(html).toContain(
      'output-value">17.8133</strong> <span class="unit">L/min',
    );
    expect(html).toContain("換算值");
    expect(html).toContain("17.8125 L/min");
    expect(html).not.toContain("原始設計處理水量");
    expect(html).toContain("1,068.75");
    expect(html).toContain("L/h");
    expect(html).toContain("單餐期用餐人數");
    expect(html).toContain("每人每餐用水量 q");
    expect(html).toContain("設備所需有效容積");
    expect(html).toContain("此依據無法計算");
    expect(html).toContain(">計算結果</span><strong>178.125 L</strong>");
  });
});
