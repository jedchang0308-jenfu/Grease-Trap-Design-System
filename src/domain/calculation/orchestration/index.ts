import {
  calculateCurrentByArea,
  calculateCurrentByDiners,
  reverseCurrentByCapacity,
  type CurrentByAreaInput,
  type CurrentByDinersInput,
  type CurrentCapacityInput,
  type CurrentResult,
} from "@/domain/calculation/current";
import {
  calculateLegacyByArea,
  calculateLegacyByDiners,
  calculateLegacyFlowByEffectiveVolume,
  calculateLegacyMeasured,
  reverseLegacyByEffectiveVolume,
  type LegacyByAreaInput,
  type LegacyByDinersInput,
  type LegacyMeasuredInput,
  type LegacyResult,
  type LegacyReverseInput,
  type LegacyVolumeToFlowInput,
} from "@/domain/calculation/legacy";
import {
  calculationBasisDisplay,
  calculationTracksForMode,
} from "@/domain/rules/source-display";
import {
  DomainInputError,
  type Track,
  type Warning,
} from "@/domain/calculation/shared";

export const taskCodes = [
  "T01_DINERS_TO_FLOW",
  "T02_DINERS_TO_DESIGN",
  "T03_AREA_TO_FLOW",
  "T04_AREA_TO_DESIGN",
  "T05_DESIGN_TO_DINERS_AND_AREA",
  "T06_EFFECTIVE_VOLUME_TO_FLOW",
] as const;
export type TaskCode = (typeof taskCodes)[number];

export const calculationModes = [
  "LEGACY_QV",
  "CURRENT_QG",
  "DUAL_COMPARISON",
] as const;
export type CalculationMode = (typeof calculationModes)[number];
export type TrackStatus =
  | "CALCULATED"
  | "INSUFFICIENT_DATA"
  | "INVALID"
  | "ERROR";
export type CalculationStatus =
  | "COMPLETE"
  | "COMPLETE_WITH_REMINDER"
  | "BLOCKED";

export type CurrentCalculationInput =
  | ({ kind: "DINERS" } & CurrentByDinersInput)
  | ({ kind: "AREA" } & CurrentByAreaInput)
  | ({ kind: "REVERSE" } & CurrentCapacityInput);

export type LegacyCalculationInput =
  | ({ kind: "DINERS" } & LegacyByDinersInput)
  | ({ kind: "AREA" } & LegacyByAreaInput)
  | ({ kind: "MEASURED" } & LegacyMeasuredInput)
  | ({ kind: "REVERSE" } & LegacyReverseInput)
  | ({ kind: "VOLUME_TO_FLOW" } & LegacyVolumeToFlowInput);

export interface TrackAssessment {
  track: Track;
  status: TrackStatus;
  requiredFields: string[];
  missingFields: string[];
  errors: string[];
  ruleSetVersion: string;
  releaseRelevance: string;
}

export interface TrackExecution {
  assessment: TrackAssessment;
  result?: CurrentResult | LegacyResult;
}

export interface OrchestrationInput {
  taskCode: TaskCode;
  mode: CalculationMode;
  currentInputs?: CurrentCalculationInput;
  legacyInputs?: LegacyCalculationInput;
}

export interface OrchestrationResult {
  taskCode: TaskCode;
  mode: CalculationMode;
  methodCodes: string[];
  status: CalculationStatus;
  releaseEligible: boolean;
  trackAssessments: TrackAssessment[];
  results: Partial<Record<Track, CurrentResult | LegacyResult>>;
  warnings: Warning[];
}

function requiredTracks(mode: CalculationMode): Track[] {
  return calculationTracksForMode(mode);
}

export function deriveCaseStatus(
  mode: CalculationMode,
  statuses: TrackStatus[],
): CalculationStatus {
  const calculated = statuses.filter(
    (status) => status === "CALCULATED",
  ).length;
  if (calculated === 0) return "BLOCKED";
  if (mode === "DUAL_COMPARISON" && calculated === 1)
    return "COMPLETE_WITH_REMINDER";
  return "COMPLETE";
}

function missingAssessment(track: Track): TrackExecution {
  return {
    assessment: {
      track,
      status: "INSUFFICIENT_DATA",
      requiredFields: [
        track === "CURRENT_QG" ? "currentInputs" : "legacyInputs",
      ],
      missingFields: [
        track === "CURRENT_QG" ? "currentInputs" : "legacyInputs",
      ],
      errors: [],
      ruleSetVersion: track === "CURRENT_QG" ? "2020.1" : "legacy.1",
      releaseRelevance:
        "此計算依據未計算；另一份計算依據有效時仍可完成報告草稿。",
    },
  };
}

function executeCurrent(input?: CurrentCalculationInput): TrackExecution {
  if (!input) return missingAssessment("CURRENT_QG");
  try {
    const result =
      input.kind === "DINERS"
        ? calculateCurrentByDiners(input)
        : input.kind === "AREA"
          ? calculateCurrentByArea(input)
          : reverseCurrentByCapacity(input);
    return {
      assessment: {
        track: "CURRENT_QG",
        status: "CALCULATED",
        requiredFields: [],
        missingFields: [],
        errors: [],
        ruleSetVersion: "2020.1",
        releaseRelevance: `${calculationBasisDisplay.CURRENT_QG.shortLabel}計算依據有效。`,
      },
      result,
    };
  } catch (error) {
    if (error instanceof DomainInputError) {
      return {
        assessment: {
          track: "CURRENT_QG",
          status: "INVALID",
          requiredFields: [],
          missingFields: [],
          errors: [error.message],
          ruleSetVersion: "2020.1",
          releaseRelevance: `${calculationBasisDisplay.CURRENT_QG.shortLabel}輸入不成立。`,
        },
      };
    }
    return {
      assessment: {
        track: "CURRENT_QG",
        status: "ERROR",
        requiredFields: [],
        missingFields: [],
        errors: [
          `${calculationBasisDisplay.CURRENT_QG.shortLabel}計算未完成。`,
        ],
        ruleSetVersion: "2020.1",
        releaseRelevance: `${calculationBasisDisplay.CURRENT_QG.shortLabel}執行錯誤。`,
      },
    };
  }
}

function executeLegacy(input?: LegacyCalculationInput): TrackExecution {
  if (!input) return missingAssessment("LEGACY_QV");
  try {
    const result =
      input.kind === "DINERS"
        ? calculateLegacyByDiners(input)
        : input.kind === "AREA"
          ? calculateLegacyByArea(input)
          : input.kind === "MEASURED"
            ? calculateLegacyMeasured(input)
            : input.kind === "REVERSE"
              ? reverseLegacyByEffectiveVolume(input)
              : calculateLegacyFlowByEffectiveVolume(input);
    return {
      assessment: {
        track: "LEGACY_QV",
        status: "CALCULATED",
        requiredFields: [],
        missingFields: [],
        errors: [],
        ruleSetVersion: "legacy.1",
        releaseRelevance: `${calculationBasisDisplay.LEGACY_QV.shortLabel}計算依據有效。`,
      },
      result,
    };
  } catch (error) {
    if (error instanceof DomainInputError) {
      const insufficient = error.fields.some((field) =>
        field.includes("selectionReason"),
      );
      return {
        assessment: {
          track: "LEGACY_QV",
          status: insufficient ? "INSUFFICIENT_DATA" : "INVALID",
          requiredFields: error.fields,
          missingFields: insufficient ? error.fields : [],
          errors: [error.message],
          ruleSetVersion: "legacy.1",
          releaseRelevance: `${calculationBasisDisplay.LEGACY_QV.shortLabel}資料不足或輸入不成立。`,
        },
      };
    }
    return {
      assessment: {
        track: "LEGACY_QV",
        status: "ERROR",
        requiredFields: [],
        missingFields: [],
        errors: [`${calculationBasisDisplay.LEGACY_QV.shortLabel}計算未完成。`],
        ruleSetVersion: "legacy.1",
        releaseRelevance: `${calculationBasisDisplay.LEGACY_QV.shortLabel}執行錯誤。`,
      },
    };
  }
}

export function orchestrateCalculation(
  input: OrchestrationInput,
): OrchestrationResult {
  const tracks = requiredTracks(input.mode);
  const executions = tracks.map((track) =>
    track === "CURRENT_QG"
      ? executeCurrent(input.currentInputs)
      : executeLegacy(input.legacyInputs),
  );
  const status = deriveCaseStatus(
    input.mode,
    executions.map((execution) => execution.assessment.status),
  );
  const results: Partial<Record<Track, CurrentResult | LegacyResult>> = {};
  for (const execution of executions) {
    if (execution.result)
      results[execution.assessment.track] = execution.result;
  }
  return {
    taskCode: input.taskCode,
    mode: input.mode,
    methodCodes: executions.flatMap((execution) =>
      execution.result ? [execution.result.methodCode] : [],
    ),
    status,
    releaseEligible: status !== "BLOCKED",
    trackAssessments: executions.map((execution) => execution.assessment),
    results,
    warnings: executions.flatMap(
      (execution) => execution.result?.warnings ?? [],
    ),
  };
}
