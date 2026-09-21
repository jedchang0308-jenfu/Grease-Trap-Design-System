export type CalculationTrack = "LEGACY_QV" | "CURRENT_QG";
export type CalculationMode = CalculationTrack | "DUAL_COMPARISON";

export const calculationTrackOrder: readonly CalculationTrack[] = [
  "LEGACY_QV",
  "CURRENT_QG",
];

export interface CalculationBasisDisplay {
  sourceCode: string;
  shortLabel: string;
  fullLabel: string;
  pdfHref: string;
  resultLabel: string;
}

export const calculationBasisDisplay: Record<
  CalculationTrack,
  CalculationBasisDisplay
> = {
  LEGACY_QV: {
    sourceCode: "SRC-LEGACY-FULL",
    shortLabel: "算法A-臺北市工務局衛工處設計說明",
    fullLabel:
      "臺北市政府工務局衛生下水道工程處《油脂截留器使用維護及設計說明》",
    pdfHref:
      "/rule-sources/SRC-LEGACY-FULL-taipei-grease-interceptor-design.pdf",
    resultLabel: "依臺北市工務局衛工處設計說明計算",
  },
  CURRENT_QG: {
    sourceCode: "SRC-CURRENT-2020",
    shortLabel: "算法B-內政部給排水規範（附錄 5）",
    fullLabel: "內政部《建築物給水排水設備設計技術規範》附錄 5",
    pdfHref:
      "/rule-sources/SRC-CURRENT-2020-building-water-drainage-appendix-5.pdf",
    resultLabel: "依內政部給排水規範（附錄 5）計算",
  },
};

export const calculationModeDisplay: Record<
  CalculationMode,
  { label: string; description: string }
> = {
  LEGACY_QV: {
    label: calculationBasisDisplay.LEGACY_QV.shortLabel,
    description: calculationBasisDisplay.LEGACY_QV.resultLabel,
  },
  CURRENT_QG: {
    label: calculationBasisDisplay.CURRENT_QG.shortLabel,
    description: calculationBasisDisplay.CURRENT_QG.resultLabel,
  },
  DUAL_COMPARISON: {
    label: "不同計算法一起對照",
    description: "同時呈現兩份資料來源的計算結果。",
  },
};

export function calculationTracksForMode(mode: string): CalculationTrack[] {
  if (mode === "CURRENT_QG") return ["CURRENT_QG"];
  if (mode === "LEGACY_QV") return ["LEGACY_QV"];
  return [...calculationTrackOrder];
}

export function basisForTrack(track: string): CalculationBasisDisplay {
  return (
    calculationBasisDisplay[track as CalculationTrack] ?? {
      sourceCode: "",
      shortLabel: "計算依據",
      fullLabel: "計算依據",
      pdfHref: "",
      resultLabel: "依本案計算依據計算",
    }
  );
}

export function modeDisplayFor(mode: string) {
  return (
    calculationModeDisplay[mode as CalculationMode] ?? {
      label: "計算依據",
      description: "依本案選定的資料來源計算。",
    }
  );
}
