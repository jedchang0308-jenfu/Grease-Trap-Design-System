import path from "node:path";
import { renderReportHtml } from "../../src/domain/report/html";
import type {
  ReportSnapshotData,
  SnapshotRun,
} from "../../src/domain/report/types";
import { renderPdfFromHtml } from "../../src/infrastructure/pdf/playwright-pdf";

const currentRun: SnapshotRun = {
  id: "sample-current-run",
  track: "CURRENT_QG",
  methodCode: "CURRENT_BY_DINERS",
  semantics: "內政部給排水規範（附錄 5）計算結果",
  inputHash: "a".repeat(64),
  raw: { qLpm: "388.8888888888888889", gKg: "112" },
  adopted: { qLpm: "388.9", gKg: "112.0" },
  ruleSet: {
    code: "RULE-CURRENT-QG",
    version: "2020.1",
    checksum:
      "f644caad4a7a5e0f4f58b7e91fb16ba3c12725c4a2dd3b8f48f3fd4b1a6f23c1",
    sourceCode: "SRC-CURRENT-2020",
    sourceTitle: "內政部《建築物給水排水設備設計技術規範》附錄 5",
    sourceHash:
      "4B2112DBB61399F03BC928FCF85B5B0796A4939356848C2D12573344BFA418E0",
  },
  steps: [
    {
      sequence: 1,
      formulaCode: "CUR-DIN-Q",
      expression: "Q=N×Wm'×(1/t)×k",
      substitution: "1000×80÷720×3.5",
      result: "388.8888888888888889",
      unit: "L/min",
      sourceRef: "A-37",
    },
    {
      sequence: 2,
      formulaCode: "CUR-DIN-G",
      expression: "G=Gu+Gb",
      substitution: "77+35",
      result: "112",
      unit: "kg",
      sourceRef: "A-37",
    },
  ],
  warnings: [],
};

const legacyRun: SnapshotRun = {
  id: "sample-legacy-run",
  track: "LEGACY_QV",
  methodCode: "LEGACY_BY_DINERS",
  semantics: "臺北市工務局衛工處設計說明計算結果：有效容積 Veff",
  inputHash: "b".repeat(64),
  raw: { qLph: "1068.75", effectiveVolumeL: "178.125" },
  adopted: { qLph: "1068.8", effectiveVolumeL: "178.2" },
  ruleSet: {
    code: "RULE-LEGACY-QV",
    version: "legacy.1",
    checksum:
      "5884db83aed5dc4de785e14e6ba03f02b0a478bf11f2e868662906cfa6f764d2",
    sourceCode: "SRC-LEGACY-FULL",
    sourceTitle:
      "臺北市政府工務局衛生下水道工程處《油脂截留器使用維護及設計說明》",
    sourceHash:
      "33FBD41FBC2797C5F1EE1C2FB1C63F225DC07258EF9E30F0474C69C537CED4C8",
  },
  steps: [
    {
      sequence: 1,
      formulaCode: "LEG-MEAN-Q",
      expression: "Qhour=arithmeticMean(baseQi)×k",
      substitution: "712.5×1.5",
      result: "1068.75",
      unit: "L/h",
      sourceRef: "SRC-LEGACY-CALC",
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
  warnings: [
    {
      code: "HISTORICAL_METHOD",
      severity: "INFO",
      message: "本結果依臺北市工務局衛工處設計說明計算。",
      details: {},
    },
  ],
};

function sample(
  name: string,
  mode: string,
  runs: SnapshotRun[],
  assessments: ReportSnapshotData["assessments"],
): ReportSnapshotData {
  const inputs: Record<string, unknown> = {};
  if (runs.some((run) => run.track === "CURRENT_QG")) {
    inputs.currentInputs = {
      kind: "DINERS",
      diningType: "CHINESE",
      people: "1000",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    };
  }
  if (runs.some((run) => run.track === "LEGACY_QV")) {
    inputs.legacyInputs = {
      kind: "DINERS",
      qLitersPerPersonMeal: "30",
      operationHours: "4",
      safetyClass: "A",
      safetyFactor: "1.5",
      selectionReason: "依來源 A 類餐飲條件採用。",
      aggregation: "SOURCE_ARITHMETIC_MEAN",
      periods: [
        {
          label: "午餐",
          people: "100",
          qLitersPerPersonMeal: "30",
          operationHours: "4",
        },
        {
          label: "晚餐",
          people: "90",
          qLitersPerPersonMeal: "30",
          operationHours: "4",
        },
      ],
    };
  }
  return {
    schemaVersion: "1.0",
    reportNumber: `RDR-01JTEST${name.toUpperCase().replaceAll("-", "").padEnd(18, "0")}`,
    case: {
      id: `sample-${name}`,
      caseGroupId: `sample-group-${name}`,
      caseNo: `SAMPLE-${name.toUpperCase()}`,
      revisionNo: 1,
      customer: "去識別範例客戶",
      location: "臺灣範例地點",
      title: `油脂截留器設計計算 - ${name}`,
      purpose: "本文件用於版型與內容回歸驗證。",
      taskCode: "T02_DINERS_TO_DESIGN",
      mode,
      lifecycleStatus: "ISSUED",
      calculationStatus:
        mode === "DUAL_COMPARISON" && runs.length === 1
          ? "COMPLETE_WITH_REMINDER"
          : "COMPLETE",
    },
    inputs,
    assessments,
    runs,
    overrides: [],
    actors: {
      preparedBy: "本機工程使用者",
      issuedBy: "本機工程使用者",
    },
    limitation: "本報告未執行特定產品或證書符合性判定。",
  };
}

const variants: Array<[string, ReportSnapshotData]> = [
  [
    "current",
    sample(
      "current",
      "CURRENT_QG",
      [currentRun],
      [
        {
          track: "CURRENT_QG",
          status: "CALCULATED",
          missingFields: [],
          errors: [],
          releaseRelevance: "內政部給排水規範（附錄 5）計算依據有效。",
        },
      ],
    ),
  ],
  [
    "legacy",
    sample(
      "legacy",
      "LEGACY_QV",
      [legacyRun],
      [
        {
          track: "LEGACY_QV",
          status: "CALCULATED",
          missingFields: [],
          errors: [],
          releaseRelevance: "臺北市工務局衛工處設計說明計算依據有效。",
        },
      ],
    ),
  ],
  [
    "dual",
    sample(
      "dual",
      "DUAL_COMPARISON",
      [currentRun, legacyRun],
      [
        {
          track: "CURRENT_QG",
          status: "CALCULATED",
          missingFields: [],
          errors: [],
          releaseRelevance: "內政部給排水規範（附錄 5）計算依據有效。",
        },
        {
          track: "LEGACY_QV",
          status: "CALCULATED",
          missingFields: [],
          errors: [],
          releaseRelevance: "臺北市工務局衛工處設計說明計算依據有效。",
        },
      ],
    ),
  ],
  [
    "dual-single-track",
    sample(
      "dual-single-track",
      "DUAL_COMPARISON",
      [currentRun],
      [
        {
          track: "CURRENT_QG",
          status: "CALCULATED",
          missingFields: [],
          errors: [],
          releaseRelevance: "內政部給排水規範（附錄 5）計算依據有效。",
        },
        {
          track: "LEGACY_QV",
          status: "INSUFFICIENT_DATA",
          missingFields: ["legacyInputs"],
          errors: [],
          releaseRelevance: "另一份計算依據未計算；不影響本次報告。",
        },
      ],
    ),
  ],
];

for (const [name, snapshot] of variants) {
  const output = path.join("output", "pdf", `grease-trap-${name}-sample.pdf`);
  await renderPdfFromHtml(renderReportHtml(snapshot), output);
  console.log(`Generated ${output}`);
}
