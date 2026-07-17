import Decimal from "decimal.js";
import type { CalculationTrack } from "@/domain/rules/source-display";
import { basisForTrack } from "@/domain/rules/source-display";
import type { SnapshotRun } from "./types";

export type InputRole =
  | "案件資料"
  | "工程選值"
  | "設備資料"
  | "實測資料"
  | "覆寫值"
  | "法規表值"
  | "本案條件"
  | "計算依據參數";
export type FormulaValueRole = InputRole | "計算中間值";

export interface ReportInputRow {
  label: string;
  value: string;
  unit: string;
  role: InputRole;
  sourceNote?: string;
}

export interface ReportInputGroup {
  track: CalculationTrack;
  sourceLabel: string;
  rows: ReportInputRow[];
}

export interface ReportOutputCell {
  state: "VALUE" | "NOT_APPLICABLE" | "NOT_COMPLETED";
  value?: string;
  unit?: string;
}

export interface ReportOutputRow {
  label: string;
  cells: Record<CalculationTrack, ReportOutputCell>;
}

export interface ReportOutputRun {
  track: string;
  adopted: Record<string, string | null>;
}

export interface DesignResultsModel {
  tracks: CalculationTrack[];
  rows: ReportOutputRow[];
}

export interface ConditionBadge {
  label: string;
  tone: "success" | "warning" | "info";
  detail?: string;
}

export interface FormulaValue {
  symbol: string;
  label: string;
  value: string;
  unit: string;
  role: FormulaValueRole;
}

interface InputFieldDefinition {
  key: string;
  label: string;
  unit: string;
  role: InputRole;
  format?: (value: unknown) => string;
  note?: (value: unknown, input: Record<string, unknown>) => string;
  show?: (input: Record<string, unknown>) => boolean;
}

interface FormulaValueDefinition {
  symbol: string;
  label: string;
  unit: string;
  role: FormulaValueRole;
}

const diningTypeLabels: Record<string, string> = {
  CHINESE: "中餐",
  WESTERN: "西餐",
  JAPANESE: "和食",
  RAMEN: "拉麵",
  UDON_SOBA: "烏龍麵、蕎麥麵",
  LIGHT_MEAL: "簡餐",
  FOOD_COURT: "小吃、美食街",
  FAST_FOOD: "速食",
  FACTORY_CAFETERIA: "工廠員工餐廳",
  STUDENT_CAFETERIA: "學生餐廳",
  SCHOOL_LUNCH: "學校午餐",
};

const currentInputFields: InputFieldDefinition[] = [
  {
    key: "diningType",
    label: "餐飲類型",
    unit: "",
    role: "工程選值",
    format: (value) => diningTypeLabels[String(value)] ?? String(value),
    note: () => "依此套用內政部附錄 5 對應參數表。",
  },
  { key: "people", label: "每日用餐人數", unit: "人/日", role: "案件資料" },
  { key: "kitchenArea", label: "廚房面積", unit: "m²", role: "案件資料" },
  { key: "diningArea", label: "用餐區面積", unit: "m²", role: "案件資料" },
  {
    key: "qCapacityLpm",
    label: "設備設計處理水量能力",
    unit: "L/min",
    role: "設備資料",
  },
  {
    key: "gCapacityKg",
    label: "設備油脂容納能力",
    unit: "kg",
    role: "設備資料",
  },
  {
    key: "evidenceSource",
    label: "能力資料來源",
    unit: "",
    role: "設備資料",
  },
  {
    key: "actualUseMinutes",
    label: "每日實際使用時間",
    unit: "min/日",
    role: "覆寫值",
    note: () =>
      "取代內政部附錄 5 流量 Q 公式中的 t（每日使用時間）；需保留案件依據。",
  },
  {
    key: "greaseCleaningDays",
    label: "油脂清除週期",
    unit: "日",
    role: "案件資料",
  },
  {
    key: "sedimentCleaningDays",
    label: "殘渣清除週期",
    unit: "日",
    role: "案件資料",
  },
];

const legacyInputFields: InputFieldDefinition[] = [
  { key: "people", label: "單餐期用餐人數", unit: "人/餐", role: "案件資料" },
  { key: "areaM2", label: "用餐營業面積", unit: "m²", role: "案件資料" },
  {
    key: "measuredWastewaterL",
    label: "實測排水量",
    unit: "L",
    role: "實測資料",
  },
  {
    key: "effectiveVolumeL",
    label: "設備有效容積",
    unit: "L",
    role: "設備資料",
  },
  {
    key: "operationHours",
    label: "餐期操作時間",
    unit: "h",
    role: "案件資料",
  },
  {
    key: "qLitersPerPersonMeal",
    label: "每人每餐用水量 q",
    unit: "L/(人·餐)",
    role: "工程選值",
    note: () => "來源允許範圍內的 exact value，需可追溯選值理由。",
  },
  {
    key: "dinerDensity",
    label: "人員密度",
    unit: "人/m²",
    role: "工程選值",
  },
  {
    key: "turnover",
    label: "翻桌率",
    unit: "次",
    role: "工程選值",
  },
  {
    key: "safetyClass",
    label: "餐飲安全分類",
    unit: "",
    role: "工程選值",
    format: (value) => `${String(value)} 類`,
  },
  {
    key: "safetyFactor",
    label: "安全係數 k",
    unit: "",
    role: "工程選值",
    note: () => "依來源分類允許值選定 exact k。",
  },
  {
    key: "aggregation",
    label: "餐期彙整方式",
    unit: "",
    role: "工程選值",
    format: (value) =>
      value === "SOURCE_ARITHMETIC_MEAN" ? "各餐期算術平均" : "單一餐期",
  },
  {
    key: "selectionSourceType",
    label: "選值來源類型",
    unit: "",
    role: "工程選值",
  },
  {
    key: "selectionBasis",
    label: "選值原因",
    unit: "",
    role: "工程選值",
  },
  {
    key: "selectionEvidence",
    label: "證據備註",
    unit: "",
    role: "工程選值",
  },
  {
    key: "selectionReason",
    label: "參數選擇理由",
    unit: "",
    role: "工程選值",
    show: (input) =>
      !hasDisplayValue(input.selectionSourceType) &&
      !hasDisplayValue(input.selectionBasis) &&
      !hasDisplayValue(input.selectionEvidence),
  },
];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function hasDisplayValue(value: unknown): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function rowsFromFields(
  input: Record<string, unknown>,
  fields: InputFieldDefinition[],
): ReportInputRow[] {
  return fields.flatMap((field) => {
    if (field.show && !field.show(input)) return [];
    const raw = input[field.key];
    if (!hasDisplayValue(raw)) return [];
    return [
      {
        label: field.label,
        value: field.format ? field.format(raw) : String(raw),
        unit: field.unit,
        role: field.role,
        sourceNote: field.note?.(raw, input),
      },
    ];
  });
}

function legacyPeriodRows(input: Record<string, unknown>): ReportInputRow[] {
  if (!Array.isArray(input.periods)) return [];
  return input.periods.flatMap((period, index) => {
    const record = asRecord(period);
    if (!record) return [];
    const name = hasDisplayValue(record.label)
      ? String(record.label)
      : `餐期 ${index + 1}`;
    const rows: ReportInputRow[] = [];
    if (hasDisplayValue(record.people)) {
      rows.push({
        label: `${name}用餐人數`,
        value: String(record.people),
        unit: "人/餐",
        role: "案件資料",
      });
    }
    if (hasDisplayValue(record.qLitersPerPersonMeal)) {
      rows.push({
        label: `${name}每人用水量`,
        value: String(record.qLitersPerPersonMeal),
        unit: "L/(人·餐)",
        role: "工程選值",
      });
    }
    if (hasDisplayValue(record.operationHours)) {
      rows.push({
        label: `${name}操作時間`,
        value: String(record.operationHours),
        unit: "h",
        role: "案件資料",
      });
    }
    return rows;
  });
}

function legacyRows(input: Record<string, unknown>): ReportInputRow[] {
  let fields = legacyInputFields;
  if (
    input.aggregation === "SOURCE_ARITHMETIC_MEAN" &&
    Array.isArray(input.periods)
  ) {
    const periods = input.periods
      .map(asRecord)
      .filter((period): period is Record<string, unknown> => period !== null);
    const needsDefaultQ = periods.some(
      (period) => !hasDisplayValue(period.qLitersPerPersonMeal),
    );
    const needsDefaultT = periods.some(
      (period) => !hasDisplayValue(period.operationHours),
    );
    fields = fields.filter((field) => {
      if (field.key === "people") return false;
      if (field.key === "qLitersPerPersonMeal") return needsDefaultQ;
      if (field.key === "operationHours") return needsDefaultT;
      return true;
    });
  }
  return [...rowsFromFields(input, fields), ...legacyPeriodRows(input)];
}

export function reportTracksForMode(mode: string): CalculationTrack[] {
  if (mode === "CURRENT_QG") return ["CURRENT_QG"];
  if (mode === "LEGACY_QV") return ["LEGACY_QV"];
  return ["CURRENT_QG", "LEGACY_QV"];
}

export function buildInputGroups(
  inputs: unknown,
  completedTracks: string[],
): ReportInputGroup[] {
  const payload = asRecord(inputs);
  if (!payload) return [];
  return completedTracks.flatMap((track) => {
    if (track !== "CURRENT_QG" && track !== "LEGACY_QV") return [];
    const key = track === "CURRENT_QG" ? "currentInputs" : "legacyInputs";
    const input = asRecord(payload[key]);
    if (!input) return [];
    const rows =
      track === "CURRENT_QG"
        ? rowsFromFields(input, currentInputFields)
        : legacyRows(input);
    return [
      {
        track,
        sourceLabel: basisForTrack(track).shortLabel,
        rows,
      },
    ];
  });
}

function completedCalculationTracks(
  completedTracks: string[],
): CalculationTrack[] {
  return completedTracks.filter(
    (track): track is CalculationTrack =>
      track === "CURRENT_QG" || track === "LEGACY_QV",
  );
}

function usesSpecialCondition(input: Record<string, unknown>): boolean {
  return (
    hasDisplayValue(input.actualUseMinutes) ||
    input.kind === "MEASURED" ||
    input.aggregation === "SOURCE_ARITHMETIC_MEAN" ||
    (Array.isArray(input.periods) && input.periods.length > 0)
  );
}

function usesEquipmentData(input: Record<string, unknown>): boolean {
  return (
    hasDisplayValue(input.qCapacityLpm) ||
    hasDisplayValue(input.gCapacityKg) ||
    hasDisplayValue(input.effectiveVolumeL)
  );
}

function hasSelectionReason(input: Record<string, unknown>): boolean {
  return (
    hasDisplayValue(input.selectionReason) ||
    hasDisplayValue(input.selectionBasis) ||
    hasDisplayValue(input.selectionEvidence)
  );
}

export function buildInputCompletenessBadges(
  inputs: unknown,
  completedTracks: string[],
  mode: string,
): ConditionBadge[] {
  const payload = asRecord(inputs);
  const completed = completedCalculationTracks(completedTracks);
  const required = reportTracksForMode(mode);
  const badges: ConditionBadge[] = [];
  const completedAllRequired = required.every((track) =>
    completed.includes(track),
  );

  if (!completed.length) {
    return [
      {
        label: "尚未完成有效計算",
        tone: "warning",
        detail: "請先完成至少一份計算依據。",
      },
    ];
  }

  if (completedAllRequired) {
    badges.push({
      label: "標準條件完成",
      tone: "success",
      detail: "已完成本模式要求的計算依據。",
    });
  } else {
    badges.push({
      label: "僅完成一份依據",
      tone: "warning",
      detail: "未完成軌不填入推測數字。",
    });
  }

  if (!payload) return badges;
  const completedInputs = completed
    .map((track) =>
      asRecord(
        payload[track === "CURRENT_QG" ? "currentInputs" : "legacyInputs"],
      ),
    )
    .filter((input): input is Record<string, unknown> => input !== null);

  const hasSpecialCondition = completedInputs.some(usesSpecialCondition);
  if (hasSpecialCondition && completedAllRequired) {
    badges[0] = {
      label: "使用特殊條件完成",
      tone: "warning",
      detail: "本次包含覆寫、實測、多餐期或其他特殊條件。",
    };
  } else if (hasSpecialCondition) {
    badges.push({
      label: "使用特殊條件",
      tone: "warning",
      detail: "本次包含覆寫、實測、多餐期或其他特殊條件。",
    });
  }
  if (completedInputs.some(usesEquipmentData)) {
    badges.push({
      label: "使用設備資料",
      tone: "info",
      detail: "本次包含設備能力或有效容積輸入。",
    });
  }

  const completedLegacy = asRecord(payload.legacyInputs);
  if (completed.includes("LEGACY_QV") && completedLegacy) {
    badges.push(
      hasSelectionReason(completedLegacy)
        ? {
            label: "工程選值已記錄",
            tone: "info",
            detail: "q、分類或 exact k 已保留選值說明。",
          }
        : {
            label: "缺少選值理由",
            tone: "warning",
            detail: "請補上 q、分類或 exact k 的選值依據。",
          },
    );
  }

  return badges;
}

function formatNumber(value: string): string {
  const numeric = Number(value);
  return Number.isFinite(numeric)
    ? numeric.toLocaleString("zh-TW", { maximumFractionDigits: 4 })
    : value;
}

function runForTrack(
  runs: ReportOutputRun[],
  track: CalculationTrack,
): ReportOutputRun | undefined {
  return runs.find((run) => run.track === track);
}

function valueCell(
  runs: ReportOutputRun[],
  track: CalculationTrack,
  key: string | null,
  unit: string,
  transform?: (value: string) => string,
): ReportOutputCell {
  const run = runForTrack(runs, track);
  if (!run) return { state: "NOT_COMPLETED" };
  if (!key) return { state: "NOT_APPLICABLE" };
  const raw = run.adopted[key];
  if (!hasDisplayValue(raw)) return { state: "NOT_APPLICABLE" };
  const value = transform ? transform(String(raw)) : formatNumber(String(raw));
  return { state: "VALUE", value, unit };
}

function hasAdoptedValue(runs: ReportOutputRun[], key: string): boolean {
  return runs.some((run) => hasDisplayValue(run.adopted[key]));
}

export function buildOutputRows(
  runs: ReportOutputRun[],
  mode: string,
): ReportOutputRow[] {
  const tracks = reportTracksForMode(mode);
  const includesCurrent = tracks.includes("CURRENT_QG");
  const includesLegacy = tracks.includes("LEGACY_QV");
  const rows: ReportOutputRow[] = [];
  const cells = (
    current: ReportOutputCell,
    legacy: ReportOutputCell,
  ): Record<CalculationTrack, ReportOutputCell> => ({
    CURRENT_QG: current,
    LEGACY_QV: legacy,
  });

  if (hasAdoptedValue(runs, "qLpm") || hasAdoptedValue(runs, "qLph")) {
    rows.push({
      label: "設計處理水量",
      cells: cells(
        valueCell(runs, "CURRENT_QG", "qLpm", "L/min"),
        valueCell(runs, "LEGACY_QV", "qLph", "L/min", (value) =>
          formatNumber(new Decimal(value).div(60).toString()),
        ),
      ),
    });
  }

  if (includesCurrent) {
    rows.push({
      label: "清除週期油脂量",
      cells: cells(
        valueCell(runs, "CURRENT_QG", "gKg", "kg"),
        valueCell(runs, "LEGACY_QV", null, ""),
      ),
    });
  }
  if (includesLegacy) {
    rows.push({
      label: "設備所需有效容積",
      cells: cells(
        valueCell(runs, "CURRENT_QG", null, ""),
        valueCell(runs, "LEGACY_QV", "effectiveVolumeL", "L"),
      ),
    });
  }
  if (hasAdoptedValue(runs, "dinersEquivalentMax")) {
    rows.push({
      label: "可支援的用餐人數",
      cells: cells(
        valueCell(runs, "CURRENT_QG", "dinersEquivalentMax", "人/日"),
        valueCell(runs, "LEGACY_QV", "dinersEquivalentMax", "人/餐"),
      ),
    });
  }
  if (hasAdoptedValue(runs, "areaEquivalentMaxM2")) {
    rows.push({
      label: "可支援的服務面積",
      cells: cells(
        valueCell(runs, "CURRENT_QG", "areaEquivalentMaxM2", "m²"),
        valueCell(runs, "LEGACY_QV", "areaEquivalentMaxM2", "m²"),
      ),
    });
  }
  return rows;
}

export function buildDesignResults(
  runs: ReportOutputRun[],
  mode: string,
): DesignResultsModel {
  return {
    tracks: reportTracksForMode(mode),
    rows: buildOutputRows(runs, mode),
  };
}

const formulaValueDefinitions: Record<string, FormulaValueDefinition[]> = {
  "CUR-DIN-Q": [
    { symbol: "N", label: "每日用餐人數", unit: "人/日", role: "本案條件" },
    { symbol: "Wm'", label: "每人用水量", unit: "L/人", role: "計算依據參數" },
    {
      symbol: "t",
      label: "每日使用時間",
      unit: "min/日",
      role: "計算依據參數",
    },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-DIN-GU": [
    { symbol: "N", label: "每日用餐人數", unit: "人/日", role: "本案條件" },
    {
      symbol: "gu",
      label: "每人上游油脂量",
      unit: "g/人",
      role: "計算依據參數",
    },
    { symbol: "iu", label: "油脂清除週期", unit: "日", role: "本案條件" },
    { symbol: "1000", label: "公克換公斤係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-DIN-GB": [
    { symbol: "N", label: "每日用餐人數", unit: "人/日", role: "本案條件" },
    {
      symbol: "gb",
      label: "每人下游油脂量",
      unit: "g/人",
      role: "計算依據參數",
    },
    { symbol: "ib", label: "殘渣清除週期", unit: "日", role: "本案條件" },
    { symbol: "1000", label: "公克換公斤係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-DIN-G": [
    { symbol: "Gu", label: "上游油脂量", unit: "kg", role: "計算中間值" },
    { symbol: "Gb", label: "下游油脂量", unit: "kg", role: "計算中間值" },
  ],
  "CUR-AREA-A": [
    { symbol: "Ak", label: "廚房面積", unit: "m²", role: "本案條件" },
    { symbol: "Ad", label: "用餐區面積", unit: "m²", role: "本案條件" },
  ],
  "CUR-AREA-Q": [
    { symbol: "A", label: "全面積", unit: "m²", role: "計算中間值" },
    {
      symbol: "Wm",
      label: "單位面積用水量",
      unit: "L/(m²·day)",
      role: "計算依據參數",
    },
    { symbol: "n", label: "餐位利用率", unit: "", role: "計算依據參數" },
    { symbol: "n0", label: "補正餐位利用率", unit: "", role: "計算依據參數" },
    {
      symbol: "t",
      label: "每日使用時間",
      unit: "min/日",
      role: "計算依據參數",
    },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-AREA-GU": [
    { symbol: "A", label: "全面積", unit: "m²", role: "計算中間值" },
    {
      symbol: "gu",
      label: "單位面積上游油脂量",
      unit: "g/(m²·day)",
      role: "計算依據參數",
    },
    { symbol: "n", label: "餐位利用率", unit: "", role: "計算依據參數" },
    { symbol: "n0", label: "補正餐位利用率", unit: "", role: "計算依據參數" },
    { symbol: "iu", label: "油脂清除週期", unit: "日", role: "本案條件" },
    { symbol: "1000", label: "公克換公斤係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-AREA-GB": [
    { symbol: "A", label: "全面積", unit: "m²", role: "計算中間值" },
    {
      symbol: "gb",
      label: "單位面積下游油脂量",
      unit: "g/(m²·day)",
      role: "計算依據參數",
    },
    { symbol: "n", label: "餐位利用率", unit: "", role: "計算依據參數" },
    { symbol: "n0", label: "補正餐位利用率", unit: "", role: "計算依據參數" },
    { symbol: "ib", label: "殘渣清除週期", unit: "日", role: "本案條件" },
    { symbol: "1000", label: "公克換公斤係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-AREA-G": [
    { symbol: "Gu", label: "上游油脂量", unit: "kg", role: "計算中間值" },
    { symbol: "Gb", label: "下游油脂量", unit: "kg", role: "計算中間值" },
  ],
  "CUR-REV-N-Q": [
    {
      symbol: "Qcapacity",
      label: "設備設計處理水量能力",
      unit: "L/min",
      role: "本案條件",
    },
    {
      symbol: "t",
      label: "每日使用時間",
      unit: "min/日",
      role: "計算依據參數",
    },
    { symbol: "Wm'", label: "每人用水量", unit: "L/人", role: "計算依據參數" },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "CUR-REV-N-G": [
    { symbol: "1000", label: "公斤換公克係數", unit: "", role: "計算依據參數" },
    {
      symbol: "Gcapacity",
      label: "設備油脂容納能力",
      unit: "kg",
      role: "本案條件",
    },
    {
      symbol: "gu",
      label: "每人上游油脂量",
      unit: "g/人",
      role: "計算依據參數",
    },
    { symbol: "iu", label: "油脂清除週期", unit: "日", role: "本案條件" },
    {
      symbol: "gb",
      label: "每人下游油脂量",
      unit: "g/人",
      role: "計算依據參數",
    },
    { symbol: "ib", label: "殘渣清除週期", unit: "日", role: "本案條件" },
  ],
  "CUR-REV-A": [
    {
      symbol: "Qcapacity",
      label: "設備設計處理水量能力上限",
      unit: "L/min",
      role: "本案條件",
    },
    {
      symbol: "Gcapacity",
      label: "設備油脂容納能力上限",
      unit: "kg",
      role: "本案條件",
    },
  ],
  "LEG-MEAN-Q": [
    {
      symbol: "baseQ",
      label: "各餐期基礎水量平均值",
      unit: "L/h",
      role: "計算中間值",
    },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "LEG-DIN-Q": [
    { symbol: "n", label: "單餐期用餐人數", unit: "人/餐", role: "本案條件" },
    {
      symbol: "q",
      label: "每人每餐用水量",
      unit: "L/(人·餐)",
      role: "計算依據參數",
    },
    { symbol: "t", label: "餐期操作時間", unit: "h", role: "本案條件" },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "LEG-MEASURED-Q": [
    { symbol: "Qmeasured", label: "實測排水量", unit: "L", role: "本案條件" },
    { symbol: "t", label: "實測期間", unit: "h", role: "本案條件" },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "LEG-AREA-N": [
    { symbol: "A", label: "用餐營業面積", unit: "m²", role: "本案條件" },
    { symbol: "d", label: "人員密度", unit: "人/m²", role: "計算依據參數" },
    { symbol: "r", label: "翻桌率", unit: "次", role: "計算依據參數" },
  ],
  "LEG-VEFF": [
    {
      symbol: "Qhour",
      label: "每小時設計處理水量",
      unit: "L/h",
      role: "計算中間值",
    },
    { symbol: "6", label: "有效容積換算係數", unit: "", role: "計算依據參數" },
  ],
  "LEG-REV-N": [
    { symbol: "6", label: "有效容積換算係數", unit: "", role: "計算依據參數" },
    { symbol: "Veff", label: "設備有效容積", unit: "L", role: "本案條件" },
    { symbol: "t", label: "餐期操作時間", unit: "h", role: "本案條件" },
    {
      symbol: "q",
      label: "每人每餐用水量",
      unit: "L/(人·餐)",
      role: "計算依據參數",
    },
    { symbol: "k", label: "安全係數", unit: "", role: "計算依據參數" },
  ],
  "LEG-REV-A": [
    { symbol: "n", label: "可支援用餐人數", unit: "人/餐", role: "計算中間值" },
    { symbol: "d", label: "人員密度", unit: "人/m²", role: "計算依據參數" },
    { symbol: "r", label: "翻桌率", unit: "次", role: "計算依據參數" },
  ],
};

function definitionsForFormula(formulaCode: string): FormulaValueDefinition[] {
  if (formulaCode.startsWith("LEG-PERIOD-")) {
    return [
      { symbol: "n", label: "該餐期用餐人數", unit: "人/餐", role: "本案條件" },
      {
        symbol: "q",
        label: "每人每餐用水量",
        unit: "L/(人·餐)",
        role: "計算依據參數",
      },
      { symbol: "t", label: "餐期操作時間", unit: "h", role: "本案條件" },
    ];
  }
  return formulaValueDefinitions[formulaCode] ?? [];
}

export function formulaValues(
  step: SnapshotRun["steps"][number],
): FormulaValue[] {
  const definitions = definitionsForFormula(step.formulaCode);
  const values = step.substitution.match(/-?\d+(?:\.\d+)?/g) ?? [];
  if (!definitions.length || values.length !== definitions.length) {
    return values.map((value, index) => ({
      symbol: `v${index + 1}`,
      label: `代入值 ${index + 1}`,
      value: formatNumber(value),
      unit: "—",
      role: "計算中間值",
    }));
  }
  return definitions.map((definition, index) => ({
    ...definition,
    value: formatNumber(values[index]),
  }));
}
