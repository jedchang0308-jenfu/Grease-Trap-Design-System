import { sha256 } from "@/domain/shared/canonical";

export const diningTypes = [
  "CHINESE",
  "WESTERN",
  "JAPANESE",
  "RAMEN",
  "UDON_SOBA",
  "LIGHT_MEAL",
  "FOOD_COURT",
  "FAST_FOOD",
  "FACTORY_CAFETERIA",
  "STUDENT_CAFETERIA",
  "SCHOOL_LUNCH",
] as const;

export type DiningType = (typeof diningTypes)[number];

export const diningLabels: Record<DiningType, string> = {
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

export interface CurrentAreaFactor {
  Wm: string;
  t: string;
  k: string;
  gu: string;
  gb: string;
}

export interface CurrentDinerFactor {
  WmPrime: string;
  t: string;
  k: string;
  gu: string;
  gb: string;
}

export const currentAreaFactors: Partial<
  Record<DiningType, CurrentAreaFactor>
> = {
  CHINESE: { Wm: "130", t: "720", k: "3.5", gu: "18", gb: "8" },
  WESTERN: { Wm: "95", t: "720", k: "3.5", gu: "9.5", gb: "3.5" },
  JAPANESE: { Wm: "100", t: "720", k: "3.5", gu: "7", gb: "2.5" },
  RAMEN: { Wm: "150", t: "720", k: "3.5", gu: "19.5", gb: "7.5" },
  UDON_SOBA: { Wm: "150", t: "720", k: "3.5", gu: "9", gb: "3" },
  LIGHT_MEAL: { Wm: "90", t: "720", k: "3.5", gu: "6", gb: "2" },
  FOOD_COURT: { Wm: "85", t: "720", k: "3.5", gu: "3.5", gb: "1.5" },
  FAST_FOOD: { Wm: "20", t: "720", k: "3.5", gu: "3", gb: "1" },
  FACTORY_CAFETERIA: { Wm: "90", t: "600", k: "3.5", gu: "6.5", gb: "3" },
  STUDENT_CAFETERIA: { Wm: "45", t: "600", k: "3.5", gu: "3", gb: "1" },
};

export const currentSeatUtilization: Partial<Record<DiningType, string>> = {
  CHINESE: "5",
  WESTERN: "4.5",
  JAPANESE: "5",
  RAMEN: "5",
  UDON_SOBA: "5",
  LIGHT_MEAL: "7",
  FOOD_COURT: "8",
  FAST_FOOD: "8",
  FACTORY_CAFETERIA: "4",
  STUDENT_CAFETERIA: "4",
};

export const currentDinerFactors: Record<DiningType, CurrentDinerFactor> = {
  CHINESE: { WmPrime: "80", t: "720", k: "3.5", gu: "11", gb: "5" },
  WESTERN: { WmPrime: "80", t: "720", k: "3.5", gu: "8", gb: "3" },
  JAPANESE: { WmPrime: "80", t: "720", k: "3.5", gu: "5.5", gb: "2" },
  RAMEN: { WmPrime: "50", t: "720", k: "3.5", gu: "6.5", gb: "2.5" },
  UDON_SOBA: { WmPrime: "50", t: "720", k: "3.5", gu: "3", gb: "1" },
  LIGHT_MEAL: { WmPrime: "45", t: "720", k: "3.5", gu: "3", gb: "1" },
  FOOD_COURT: { WmPrime: "25", t: "720", k: "3.5", gu: "1", gb: "0.5" },
  FAST_FOOD: { WmPrime: "10", t: "720", k: "3.5", gu: "1.5", gb: "0.5" },
  FACTORY_CAFETERIA: {
    WmPrime: "50",
    t: "600",
    k: "3.5",
    gu: "3.5",
    gb: "1.5",
  },
  STUDENT_CAFETERIA: {
    WmPrime: "25",
    t: "600",
    k: "3.5",
    gu: "1.5",
    gb: "0.5",
  },
  SCHOOL_LUNCH: { WmPrime: "15", t: "480", k: "3.5", gu: "0.7", gb: "0.3" },
};

export const a36Areas = [
  25, 50, 75, 100, 125, 150, 175, 200, 250, 300, 400, 500, 600, 700, 800, 1000,
  1500,
] as const;

type N0Row = readonly (string | null)[];
export const currentN0Table: Partial<Record<DiningType, N0Row>> = {
  CHINESE: [
    null,
    null,
    "3.1",
    "3.1",
    "3.2",
    "3.3",
    "3.3",
    "3.3",
    "3.4",
    "3.4",
    "3.4",
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  WESTERN: [
    null,
    null,
    null,
    "2",
    "2.1",
    "2.3",
    "2.4",
    "2.6",
    "2.8",
    "2.9",
    "3.1",
    "3.2",
    "3.3",
    "3.3",
    "3.4",
    null,
    null,
  ],
  JAPANESE: [
    null,
    null,
    "2.1",
    "2.3",
    "2.5",
    "2.6",
    "2.7",
    "2.8",
    "2.9",
    "3",
    "3.2",
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  RAMEN: [
    null,
    "3.1",
    "3.9",
    "4.5",
    "4.9",
    "5.2",
    "5.5",
    "5.7",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  UDON_SOBA: [
    null,
    "3.1",
    "3.9",
    "4.5",
    "4.9",
    "5.2",
    "5.5",
    "5.7",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  LIGHT_MEAL: [
    "3.3",
    "4.2",
    "4.4",
    "4.7",
    "4.8",
    "4.9",
    "4.9",
    "5",
    "5.1",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  FOOD_COURT: [
    "3.7",
    "4.7",
    "5.3",
    "5.7",
    "5.9",
    "6",
    "6.1",
    "6.2",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  FAST_FOOD: [
    "3.3",
    "4.2",
    "4.4",
    "4.7",
    "4.8",
    "4.9",
    "4.9",
    "5",
    "5.1",
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
  ],
  FACTORY_CAFETERIA: [
    null,
    null,
    null,
    null,
    null,
    "2.4",
    "2.6",
    "2.8",
    "3",
    "3.3",
    "3.6",
    "3.8",
    "3.9",
    "4.1",
    "4.2",
    "4.3",
    "4.5",
  ],
  STUDENT_CAFETERIA: [
    null,
    null,
    null,
    null,
    null,
    "2.4",
    "2.6",
    "2.8",
    "3",
    "3.3",
    "3.6",
    "3.8",
    "3.9",
    "4.1",
    "4.2",
    "4.3",
    "4.5",
  ],
};

export const legacyWaterFactors = {
  TOURIST_HOTEL: {
    label: "觀光飯店",
    qMin: "70",
    qMax: "120",
    turnover: "3",
    density: "0.5",
  },
  SMALL_RESTAURANT: {
    label: "中小型餐廳",
    qMin: "30",
    qMax: "50",
    turnover: "5",
    density: "0.5",
  },
  WESTERN_FAST_FOOD: {
    label: "西式速食",
    qMin: "13",
    qMax: "33",
    turnover: "8",
    density: "0.5",
  },
  LUNCH_BOX_CENTER: {
    label: "便當中心",
    qMin: "25",
    qMax: "100",
    turnover: null,
    density: null,
  },
  INSTITUTIONAL_CAFETERIA: {
    label: "機關團體餐廳",
    qMin: "100",
    qMax: "150",
    turnover: null,
    density: null,
  },
} as const;

export const legacySafetyFactors = {
  A: ["1.5"],
  B: ["1.3", "1.4"],
  C: ["1.2", "1.3"],
} as const;

export const sourceDocuments = [
  {
    code: "SRC-CURRENT-2020",
    title: "建築物給水排水設備設計技術規範 附錄 5",
    authorityLevel: "OFFICIAL_CURRENT",
    checkedAt: "2026-07-13",
    uri: "https://www.nlma.gov.tw/filesys/file/chinese/publication/law2/1090811791a.pdf",
    sha256: "4B2112DBB61399F03BC928FCF85B5B0796A4939356848C2D12573344BFA418E0",
    status: "ACTIVE",
  },
  {
    code: "SRC-LEGACY-CALC",
    title: "油脂截留槽計算 5 頁摘錄",
    authorityLevel: "HISTORICAL_REFERENCE",
    checkedAt: "2026-07-13",
    uri: "J:/共用雲端硬碟/99_總經理室Google雲端/法規標準/法規-產品/臺北市政府工務局衛生下水道工程處_油脂截留槽計算.pdf",
    sha256: "5154E7B806F81EFEB855851CD3F280D4C80656A2AE62F7BAE2DD65B6453F98C5",
    status: "HISTORICAL",
  },
  {
    code: "SRC-LEGACY-FULL",
    title: "油脂截留器使用維護及設計說明 9 頁",
    authorityLevel: "HISTORICAL_PRIMARY",
    checkedAt: "2026-07-13",
    uri: "J:/共用雲端硬碟/99_總經理室Google雲端/法規標準/法規-產品/臺北市政府工務局衛生下水道工程處_油脂截留器使用維護及設計說明.pdf",
    sha256: "33FBD41FBC2797C5F1EE1C2FB1C63F225DC07258EF9E30F0474C69C537CED4C8",
    status: "HISTORICAL",
  },
] as const;

export const sourceDiscrepancies = [
  [
    "DISC-LEG-001",
    "SRC-LEGACY-FULL",
    "舊版 q 的文字單位與公式語意不一致",
    "正規化為 L/(人·餐)，保留原文差異",
  ],
  [
    "DISC-LEG-002",
    "SRC-LEGACY-CALC",
    "學校案例中間式漏一個 0",
    "依 n=500×3=1500 重算 Q=19500 L/h",
  ],
  [
    "DISC-LEG-003",
    "SRC-LEGACY-CALC",
    "面積案例顯示 300，後續使用 3000÷6",
    "採數學正確值 3000 L/h；500 L 作回歸",
  ],
  [
    "DISC-LEG-004",
    "SRC-LEGACY-FULL",
    "便當中心用水範圍顯示順序不一致",
    "保存 min=25、max=100",
  ],
  [
    "DISC-LEG-005",
    "SRC-LEGACY-FULL",
    "B、C 類各有兩個可選安全係數",
    "必須由工程人員選 exact k 並保存理由",
  ],
  [
    "DISC-CUR-001",
    "SRC-CURRENT-2020",
    "官方案例顯示值截斷至小數一位",
    "正式比較使用重新運算 raw 值",
  ],
  [
    "DISC-CUR-002",
    "SRC-CURRENT-2020",
    "中餐 400 m² 後空白，但 610 m² 官方案例使用 n0=3.4",
    "只建立 610 m² 精確來源例外",
  ],
] as const;

export const currentRulePayload = {
  source: "SRC-CURRENT-2020",
  areaFactors: currentAreaFactors,
  seatUtilization: currentSeatUtilization,
  n0Areas: a36Areas,
  n0Table: currentN0Table,
  sourceException: { diningType: "CHINESE", area: "610", n0: "3.4" },
  dinerFactors: currentDinerFactors,
};

export const legacyRulePayload = {
  source: "SRC-LEGACY-FULL",
  waterFactors: legacyWaterFactors,
  safetyFactors: legacySafetyFactors,
  discrepancies: sourceDiscrepancies.filter(([code]) =>
    code.startsWith("DISC-LEG"),
  ),
};

export const currentRuleChecksum = sha256(currentRulePayload);
export const legacyRuleChecksum = sha256(legacyRulePayload);
