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
    expect(html).toContain("版次：版本 1");
    expect(html).toContain("正式報告");
    expect(html).not.toContain("文件狀態：草稿");
    expect(html).not.toContain("不代表公司身分驗證或公司簽核效力");
    expect(html).toContain('<table class="summary-table">');
    expect(html).not.toContain(
      "<thead><tr><th>項目</th><th>內容</th><th>項目</th><th>內容</th></tr></thead>",
    );
    expect(html).toContain('<th scope="row">本次計算任務</th>');
    expect(html).toContain('<th scope="row">算法依據</th>');
    expect(html).not.toContain('<th scope="row">計算依據</th>');
  });

  it("keeps unavailable case metadata in the compact summary", () => {
    const data = snapshot();
    data.case.customer = "未提供";
    data.case.location = "未提供";

    const html = renderReportHtml(data);

    expect(html).toContain('<th scope="row">客戶</th>');
    expect(html).toContain('<th scope="row">設置地點</th>');
    expect(html).toContain("未提供");
  });

  it("renders formula symbols with subscripts", () => {
    const data = snapshot();
    data.case.mode = "LEGACY_QV";
    data.case.taskCode = "T06_EFFECTIVE_VOLUME_TO_FLOW";
    data.inputs = {
      legacyInputs: {
        kind: "VOLUME_TO_FLOW",
        effectiveVolumeL: "500",
        evidenceSource: "設備圖面 A-01",
      },
    };
    data.runs[0].track = "LEGACY_QV";
    data.runs[0].methodCode = "LEGACY_FLOW_BY_EFFECTIVE_VOLUME";
    data.runs[0].raw = { qLph: "3000", qLpm: "50" };
    data.runs[0].adopted = { qLph: "3000" };
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
    expect(html).not.toContain('class="result-purpose"');
    expect(html).toContain(
      '<span class="step-index">步驟 1</span>由有效容積換算每小時處理水量',
    );
    expect(html).toContain(
      '<span class="step-index">步驟 2</span>換算每分鐘設計處理水量',
    );
    expect(html).not.toContain("以下為參考計算");
    expect(html).not.toContain("step-relevance");
    expect(html).toContain(
      '<p class="step-line step-result"><span class="step-label">計算結果</span><strong>3,000 L/h</strong>',
    );
    expect(html).toContain(
      '<p class="step-line step-result step-primary-result"><span class="step-label">計算結果</span><strong>50 L/min</strong>',
    );
    expect(html).not.toContain('class="topic-outcome"');
    expect(html).not.toContain("依本算法公式計算");
    expect(html).not.toContain("4.1.1");
  });

  it("renders a dual single-track report without fake values", () => {
    const html = renderReportHtml(snapshot());
    expect(html).toContain("文件狀態：草稿");
    expect(html).not.toContain("本文件為瀏覽器產生的報告草稿");
    expect(html).not.toContain('class="screen-footer-page"');
    expect(html).not.toContain(".screen-report-footer::before");
    expect(html).not.toContain(".screen-report-footer::after");
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
    expect(html).toContain("本次只完成一份算法依據");
    expect(html).toContain("<h2>1 案件資料</h2>");
    expect(html).toContain("<h2>2 本次輸入條件</h2>");
    expect(html).toContain("<h3>2.1 算法B-內政部給排水規範（附錄 5）</h3>");
    expect(html).toContain("<h2>3 本次設計結果</h2>");
    expect(html).toContain("<h2>4 完整計算過程</h2>");
    expect(html).toContain("<h3>4.1 使用算法B-內政部給排水規範（附錄 5）</h3>");
    expect(html).not.toContain('class="result-purpose"');
    expect(html).toContain(
      '<span class="step-index">步驟 1</span>計算設計處理水量（尖峰每分鐘）',
    );
    expect(html).not.toContain("4.1.1");
    expect(html).toContain("算法B-內政部給排水規範（附錄 5）");
    expect(html).toContain("算法A-臺北市工務局衛工處設計說明");
    expect(html).toContain("未完成");
    expect(html).toContain("設計處理水量");
    expect(html).toContain(
      '<td class="output-cell-final"><strong class="output-value">29.2</strong>',
    );
    expect(html).toContain(
      '<td class="output-cell-final"><strong class="output-value">2.1</strong>',
    );
    expect(html).toContain(
      '<td><span class="cell-state not-completed">未完成</span></td>',
    );
    expect(html).toContain("本次輸入條件");
    expect(html).toContain("本次設計結果");
    expect(html).toContain("本案條件");
    expect(html).toContain("算法依據參數");
    expect(html).toContain(
      ".input-table .number-cell { white-space: normal; overflow-wrap: anywhere; }",
    );
    expect(html).not.toContain('<td class="number-cell"><strong>100</strong>');
    expect(html).not.toContain(
      '<p class="result-guide"><strong>下表顯示本次採用值。</strong>',
    );
    expect(html).not.toContain(
      'class="step-comparison"><span class="step-label">換算值</span><strong>',
    );
    expect(html).toContain(
      '<p class="step-line step-result step-primary-result"><span class="step-label">計算結果</span><strong>',
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
    expect(html).toContain("29.2 L/min");
    expect(html).not.toContain("每分鐘流量");
    expect(html).not.toContain("未取整");
    expect(html).toContain("以下僅列本次計算任務的計算步驟");
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
    expect(html).not.toContain("算法依據與追溯資料");
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

  it("shows only purpose outputs by default and adds reference outputs when selected", () => {
    const data = snapshot();
    data.case.taskCode = "T01_DINERS_TO_FLOW";

    const html = renderReportHtml(data);
    const htmlWithReferences = renderReportHtml(data, "DRAFT", {
      includeReferenceCalculations: true,
    });

    expect(html).toContain(
      '<tr><th>設計處理水量</th><td><span class="cell-state not-completed">未完成</span></td><td class="output-cell-final"><strong class="output-value">29.2</strong>',
    );
    expect(html).not.toContain("<tr><th>清除週期油脂量</th>");
    expect(htmlWithReferences).toContain(
      '<tr><th>清除週期油脂量</th><td><span class="cell-state not-completed">未完成</span></td><td><strong class="output-value">2.1</strong>',
    );
    expect(htmlWithReferences).not.toContain(
      '<tr><th>清除週期油脂量</th><td class="output-cell-final">',
    );
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
    expect(html).toContain("<h3>2.1 算法A-臺北市工務局衛工處設計說明</h3>");
    expect(html).toContain("<h3>2.2 算法B-內政部給排水規範（附錄 5）</h3>");
    expect(html).toContain("<h3>4.1 使用算法A-臺北市工務局衛工處設計說明</h3>");
    expect(html).toContain("<h3>4.2 使用算法B-內政部給排水規範（附錄 5）</h3>");
    expect(html).not.toContain('class="result-purpose"');
    expect(html).not.toContain("4.2.2");
    expect(html).toContain("使用算法A-臺北市工務局衛工處設計說明");
    expect(html).toContain("計算設計處理水量（每小時）");
    expect(html).toContain("計算設備所需有效容積");
    expect(html).toContain("1068.75÷6");
    expect(html).not.toContain("下表顯示本次採用值");
    expect(html).toContain(
      'output-value">17.8133</strong> <span class="unit">L/min',
    );
    expect(html).toContain("每分鐘流量");
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

  it("omits reference calculations by default and preserves their order when included", () => {
    const data = snapshot();
    data.case.taskCode = "T01_DINERS_TO_FLOW";
    data.runs[0].adopted = { qLpm: "4.9", gKg: "1.4" };
    data.runs[0].steps = [
      {
        sequence: 1,
        formulaCode: "CUR-DIN-Q",
        expression: "Q=N×Wm'×(1/t)×k",
        substitution: "100×10÷720×3.5",
        result: "4.8611",
        unit: "L/min",
        sourceRef: "A-37",
      },
      {
        sequence: 2,
        formulaCode: "CUR-DIN-GU",
        expression: "Gu=(1/1000)×N×gu×iu",
        substitution: "100×1.5×7÷1000",
        result: "1.05",
        unit: "kg",
        sourceRef: "A-37",
      },
      {
        sequence: 3,
        formulaCode: "CUR-DIN-GB",
        expression: "Gb=(1/1000)×N×gb×ib",
        substitution: "100×0.5×7÷1000",
        result: "0.35",
        unit: "kg",
        sourceRef: "A-37",
      },
      {
        sequence: 4,
        formulaCode: "CUR-DIN-G",
        expression: "G=Gu+Gb",
        substitution: "1.05+0.35",
        result: "1.4",
        unit: "kg",
        sourceRef: "A-37",
      },
    ];

    const html = renderReportHtml(data);
    const htmlWithReferences = renderReportHtml(data, "DRAFT", {
      includeReferenceCalculations: true,
    });

    expect(html).toContain(
      "<strong>本次計算任務｜由每日用餐人數換算流量</strong>",
    );
    expect(html).toContain("<h2>4 本次計算任務過程</h2>");
    expect(htmlWithReferences).toContain("<h2>4 完整計算過程</h2>");
    expect(html).not.toContain('class="result-purpose"');
    expect(html).not.toContain('class="topic-outcome"');
    expect(html).toContain(
      '<span class="step-index">步驟 1</span>計算設計處理水量（尖峰每分鐘）',
    );
    expect(html).not.toContain("計算上游清除週期油脂量");
    expect(html).not.toContain("計算下游清除週期油脂量");
    expect(html).not.toContain("合計清除週期油脂量");
    expect(html).not.toContain("<td>油脂清除週期</td>");
    expect(html).not.toContain("<td>殘渣清除週期</td>");
    expect(htmlWithReferences).toContain("<td>油脂清除週期</td>");
    expect(htmlWithReferences).toContain("<td>殘渣清除週期</td>");
    expect(html).not.toContain("<tr><th>清除週期油脂量</th>");
    expect(htmlWithReferences).toContain("<tr><th>清除週期油脂量</th>");
    expect(htmlWithReferences).toContain("以下列出完整計算步驟");
    expect(htmlWithReferences).toContain(
      '<li class="algorithm-step is-reference"><p class="step-purpose"><span class="step-index">步驟 2</span>計算上游清除週期油脂量',
    );
    expect(htmlWithReferences).toContain(
      '<span class="step-index">步驟 4</span>合計清除週期油脂量',
    );
    expect(htmlWithReferences).not.toContain("reference-details");
    expect(htmlWithReferences).toContain('class="reference-divider"');
    expect(htmlWithReferences).toContain("以下為參考計算");
    expect(htmlWithReferences).toContain(
      ".reference-divider::before, .reference-divider::after",
    );
    expect(htmlWithReferences).toContain(
      "grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr)",
    );
    expect(html).not.toContain("step-relevance");
    expect(html).not.toContain("本次目的");
    expect(html).toContain(
      '<p class="step-line step-result step-primary-result"><span class="step-label">計算結果</span><strong>4.9 L/min</strong>',
    );
    expect(htmlWithReferences).toContain(
      '<p class="step-line step-result"><span class="step-label">計算結果</span><strong>1.05 kg</strong>',
    );
    expect(
      htmlWithReferences.indexOf("計算設計處理水量（尖峰每分鐘）"),
    ).toBeLessThan(htmlWithReferences.indexOf("計算上游清除週期油脂量"));
    expect(htmlWithReferences.indexOf("計算上游清除週期油脂量")).toBeLessThan(
      htmlWithReferences.indexOf("計算下游清除週期油脂量"),
    );
    expect(htmlWithReferences.indexOf("計算下游清除週期油脂量")).toBeLessThan(
      htmlWithReferences.indexOf("合計清除週期油脂量"),
    );
    expect(html).not.toMatch(/4\.1\.\d/);
    expect(html).not.toContain("每分鐘流量");
  });

  it("includes formal reference calculations only when selected upstream", () => {
    const data = snapshot();
    data.case.taskCode = "T01_DINERS_TO_FLOW";
    data.runs[0].steps = [
      {
        sequence: 1,
        formulaCode: "CUR-DIN-Q",
        expression: "Q=N×Wm'×(1/t)×k",
        substitution: "100×10÷720×3.5",
        result: "4.8611",
        unit: "L/min",
        sourceRef: "A-37",
      },
      {
        sequence: 2,
        formulaCode: "CUR-DIN-GU",
        expression: "Gu=(1/1000)×N×gu×iu",
        substitution: "100×1.5×7÷1000",
        result: "1.05",
        unit: "kg",
        sourceRef: "A-37",
      },
    ];

    const purposeOnlyHtml = renderReportHtml(data, "FORMAL");
    const html = renderReportHtml(data, "FORMAL", {
      includeReferenceCalculations: true,
    });

    expect(purposeOnlyHtml).not.toContain("計算上游清除週期油脂量");
    expect(html).not.toContain("reference-details");
    expect(html).toContain('class="reference-divider"');
    expect(html).toContain(
      '<span class="step-index">步驟 2</span>計算上游清除週期油脂量',
    );
  });

  it("keeps area calculations in result-topic order for both methods", () => {
    const data = snapshot();
    data.case.taskCode = "T04_AREA_TO_DESIGN";
    data.runs[0].methodCode = "CURRENT_BY_TOTAL_AREA";
    data.runs[0].adopted = { qLpm: "31.2", gKg: "9" };
    data.runs[0].steps = [
      {
        sequence: 1,
        formulaCode: "CUR-AREA-A",
        expression: "A=Ak+Ad",
        substitution: "50+150",
        result: "200",
        unit: "m²",
        sourceRef: "case-input",
      },
      {
        sequence: 2,
        formulaCode: "CUR-AREA-Q",
        expression: "Q=A×Wm×(n/n0)×(1/t)×k",
        substitution: "200×20×(8/5)÷720×3.5",
        result: "31.1111",
        unit: "L/min",
        sourceRef: "A-34～A-36",
      },
      {
        sequence: 3,
        formulaCode: "CUR-AREA-G",
        expression: "G=Gu+Gb",
        substitution: "6.72+2.24",
        result: "8.96",
        unit: "kg",
        sourceRef: "A-34～A-36",
      },
    ];
    data.runs.push({
      ...data.runs[0],
      id: "legacy-area",
      track: "LEGACY_QV",
      methodCode: "LEGACY_BY_AREA",
      adopted: { qLph: "5400", effectiveVolumeL: "900" },
      steps: [
        {
          sequence: 1,
          formulaCode: "LEG-AREA-N",
          expression: "n=area×dinerDensity×turnover",
          substitution: "150×0.5×8",
          result: "600",
          unit: "person",
          sourceRef: "SRC-LEGACY-FULL",
        },
        {
          sequence: 2,
          formulaCode: "LEG-DIN-Q",
          expression: "Qhour=(n×q/t)×k",
          substitution: "600×30÷5×1.5",
          result: "5400",
          unit: "L/h",
          sourceRef: "SRC-LEGACY-FULL",
        },
        {
          sequence: 3,
          formulaCode: "LEG-VEFF",
          expression: "Veff=Qhour/6",
          substitution: "5400÷6",
          result: "900",
          unit: "L",
          sourceRef: "SRC-LEGACY-FULL",
        },
      ],
    });

    const html = renderReportHtml(data);

    expect(html).not.toContain('class="result-purpose"');
    expect(html).not.toContain("參考計算");
    expect(html).toContain(">計算結果</span><strong>600 人</strong>");
    expect(html).not.toContain('class="result-purpose"');
    expect(html).toContain(
      '<span class="step-index">步驟 2</span>計算設計處理水量（尖峰每分鐘）',
    );
    expect(html).not.toMatch(/4\.[12]\.\d/);
  });

  it("groups reverse calculations into supported diners and area", () => {
    const data = snapshot();
    data.case.taskCode = "T05_DESIGN_TO_DINERS_AND_AREA";
    data.runs[0].methodCode = "CURRENT_REVERSE_BY_CAPACITY";
    data.runs[0].adopted = {
      dinersEquivalentMax: "641",
      areaEquivalentMaxM2: "200.6",
    };
    data.runs[0].steps = [
      {
        sequence: 1,
        formulaCode: "CUR-REV-N-Q",
        expression: "N_by_Q=Qcapacity×t/(Wm'×k)",
        substitution: "31.2×720÷(10×3.5)",
        result: "641.8286",
        unit: "person",
        sourceRef: "A-37",
      },
      {
        sequence: 2,
        formulaCode: "CUR-REV-N-G",
        expression: "N_by_G=1000×Gcapacity/(gu×iu+gb×ib)",
        substitution: "1000×9÷(1.5×7+0.5×7)",
        result: "642.8571",
        unit: "person",
        sourceRef: "A-37",
      },
      {
        sequence: 3,
        formulaCode: "CUR-REV-A",
        expression: "piecewise A-36 strict solver",
        substitution: "Q(A)<31.2 and G(A)<9",
        result: "200.6",
        unit: "m²",
        sourceRef: "A-34～A-36",
      },
    ];
    data.runs.push({
      ...data.runs[0],
      id: "legacy-reverse",
      track: "LEGACY_QV",
      methodCode: "LEGACY_REVERSE_BY_EFFECTIVE_VOLUME",
      adopted: {
        dinersEquivalentMax: "600",
        areaEquivalentMaxM2: "150",
      },
      steps: [
        {
          sequence: 1,
          formulaCode: "LEG-REV-N",
          expression: "nEquivalentMax=(6×Veff×t)/(q×k)",
          substitution: "6×900×5÷(30×1.5)",
          result: "600",
          unit: "person",
          sourceRef: "SRC-LEGACY-FULL",
        },
        {
          sequence: 2,
          formulaCode: "LEG-REV-A",
          expression: "areaEquivalentMax=n/(density×turnover)",
          substitution: "600÷(0.5×8)",
          result: "150",
          unit: "m²",
          sourceRef: "SRC-LEGACY-FULL",
        },
      ],
    });

    const html = renderReportHtml(data);

    expect(html).not.toContain('class="result-purpose"');
    expect(html).not.toContain('class="topic-outcome"');
    expect(html).not.toContain("參考計算");
    expect(html).toContain(
      '<p class="step-line step-result step-primary-result"><span class="step-label">計算結果</span><strong>641.8286 人</strong>',
    );
    expect(html).toContain(
      '<p class="step-line step-result"><span class="step-label">計算結果</span><strong>642.8571 人</strong>',
    );
    expect(html).not.toMatch(/4\.[12]\.\d/);
  });

  it("marks regenerated historical reports in the document body", () => {
    const html = renderReportHtml(snapshot(), "DRAFT", {
      provenance: "REGENERATED_HISTORY",
    });

    expect(html).toContain("歷史版本重新產生");
    expect(html).toContain("保存的歷史資料套用目前版型");
    expect(html).toContain("資料來源：歷史版本重新產生");
  });
});
