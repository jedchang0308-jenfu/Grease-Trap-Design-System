import Decimal from "decimal.js";
import { calculationBasisDisplay } from "@/domain/rules/source-display";
import {
  ceilTenth,
  decimal,
  decimalString,
  DomainInputError,
  floorTenth,
  sourceDisplayTenth,
  step,
  type CalculationStep,
  type Warning,
} from "@/domain/calculation/shared";

interface LegacyBase {
  qLitersPerPersonMeal: Decimal.Value;
  operationHours: Decimal.Value;
  safetyFactor: Decimal.Value;
  safetyClass?: "A" | "B" | "C";
  selectionReason?: string;
}

export interface LegacyPeriod {
  label: string;
  people: Decimal.Value;
  qLitersPerPersonMeal?: Decimal.Value;
  operationHours?: Decimal.Value;
}

export interface LegacyByDinersInput extends LegacyBase {
  people?: Decimal.Value;
  periods?: LegacyPeriod[];
  aggregation?: "SINGLE_PERIOD" | "SOURCE_ARITHMETIC_MEAN";
}

export interface LegacyByAreaInput extends LegacyBase {
  areaM2: Decimal.Value;
  dinerDensity: Decimal.Value;
  turnover: Decimal.Value;
}

export interface LegacyMeasuredInput {
  measuredWastewaterL: Decimal.Value;
  operationHours: Decimal.Value;
  safetyFactor: Decimal.Value;
  selectionReason?: string;
}

export interface LegacyReverseInput extends LegacyBase {
  effectiveVolumeL: Decimal.Value;
  dinerDensity: Decimal.Value;
  turnover: Decimal.Value;
}

export interface LegacyResult {
  track: "LEGACY_QV";
  methodCode:
    | "LEGACY_BY_DINERS"
    | "LEGACY_BY_AREA"
    | "LEGACY_REVERSE_BY_EFFECTIVE_VOLUME";
  semantics: string;
  raw: Record<string, string | null>;
  sourceDisplay: Record<string, string | null>;
  adopted: Record<string, string | null>;
  steps: CalculationStep[];
  warnings: Warning[];
  metadata: Record<string, unknown>;
}

function validateSafetyFactor(
  value: Decimal.Value,
  safetyClass?: "A" | "B" | "C",
  reason?: string,
) {
  const factor = decimal(value, "safetyFactor");
  const allowed =
    safetyClass === "A"
      ? ["1.5"]
      : safetyClass === "B"
        ? ["1.3", "1.4"]
        : safetyClass === "C"
          ? ["1.2", "1.3"]
          : ["1.2", "1.3", "1.4", "1.5"];
  if (!allowed.some((candidate) => factor.eq(candidate)))
    throw new DomainInputError("安全係數不在來源允許值內。", ["safetyFactor"]);
  if ((safetyClass === "B" || safetyClass === "C") && !reason?.trim()) {
    throw new DomainInputError("B／C 類必須填寫 exact k 選擇理由。", [
      "selectionReason",
    ]);
  }
  return factor;
}

function buildForwardResult(
  qHour: Decimal,
  steps: CalculationStep[],
  metadata: Record<string, unknown>,
): LegacyResult {
  const volume = qHour.div(6);
  step(
    steps,
    "LEG-VEFF",
    "Veff=Qhour/6",
    `${qHour}÷6`,
    volume,
    "L",
    "SRC-LEGACY-FULL",
  );
  return {
    track: "LEGACY_QV",
    methodCode: "LEGACY_BY_DINERS",
    semantics: `${calculationBasisDisplay.LEGACY_QV.shortLabel}計算結果：有效容積 Veff`,
    raw: {
      qLph: decimalString(qHour),
      effectiveVolumeL: decimalString(volume),
    },
    sourceDisplay: {
      qLph: decimalString(sourceDisplayTenth(qHour)),
      effectiveVolumeL: decimalString(sourceDisplayTenth(volume)),
    },
    adopted: {
      qLph: decimalString(ceilTenth(qHour)),
      effectiveVolumeL: decimalString(ceilTenth(volume)),
    },
    steps,
    warnings: [
      {
        code: "HISTORICAL_METHOD",
        severity: "INFO",
        track: "LEGACY_QV",
        message: `本結果依${calculationBasisDisplay.LEGACY_QV.shortLabel}計算。`,
      },
    ],
    metadata: { ...metadata, ruleSet: "RULE-LEGACY-QV@legacy.1" },
  };
}

export function calculateLegacyByDiners(
  input: LegacyByDinersInput,
): LegacyResult {
  const k = validateSafetyFactor(
    input.safetyFactor,
    input.safetyClass,
    input.selectionReason,
  );
  const defaultQ = decimal(input.qLitersPerPersonMeal, "qLitersPerPersonMeal");
  const defaultT = decimal(input.operationHours, "operationHours");
  const steps: CalculationStep[] = [];

  if (input.aggregation === "SOURCE_ARITHMETIC_MEAN") {
    if (!input.periods || input.periods.length < 2)
      throw new DomainInputError("餐期平均至少需要兩個餐期。", ["periods"]);
    const bases = input.periods.map((period, index) => {
      const people = decimal(period.people, `periods.${index}.people`);
      const q = period.qLitersPerPersonMeal
        ? decimal(period.qLitersPerPersonMeal, `periods.${index}.q`)
        : defaultQ;
      const t = period.operationHours
        ? decimal(period.operationHours, `periods.${index}.operationHours`)
        : defaultT;
      const base = people.mul(q).div(t);
      step(
        steps,
        `LEG-PERIOD-${index + 1}`,
        "baseQi=ni×qi/ti",
        `${people}×${q}÷${t}`,
        base,
        "L/h",
        "SRC-LEGACY-CALC",
      );
      return base;
    });
    const baseMean = Decimal.sum(...bases).div(bases.length);
    const qHour = baseMean.mul(k);
    step(
      steps,
      "LEG-MEAN-Q",
      "Qhour=arithmeticMean(baseQi)×k",
      `${baseMean}×${k}`,
      qHour,
      "L/h",
      "SRC-LEGACY-CALC",
    );
    return buildForwardResult(qHour, steps, {
      aggregation: "SOURCE_ARITHMETIC_MEAN",
      safetyFactor: k.toString(),
    });
  }

  if (input.people === undefined)
    throw new DomainInputError("單餐期必須填寫人數。", ["people"]);
  const people = decimal(input.people, "people");
  const qHour = people.mul(defaultQ).div(defaultT).mul(k);
  step(
    steps,
    "LEG-DIN-Q",
    "Qhour=(n×q/t)×k",
    `${people}×${defaultQ}÷${defaultT}×${k}`,
    qHour,
    "L/h",
    "SRC-LEGACY-FULL",
  );
  return buildForwardResult(qHour, steps, {
    aggregation: "SINGLE_PERIOD",
    safetyFactor: k.toString(),
  });
}

export function calculateLegacyMeasured(
  input: LegacyMeasuredInput,
): LegacyResult {
  const measured = decimal(input.measuredWastewaterL, "measuredWastewaterL");
  const hours = decimal(input.operationHours, "operationHours");
  const k = validateSafetyFactor(
    input.safetyFactor,
    undefined,
    input.selectionReason,
  );
  const qHour = measured.div(hours).mul(k);
  const steps: CalculationStep[] = [];
  step(
    steps,
    "LEG-MEASURED-Q",
    "Qhour=measuredWastewaterL/operationHours×k",
    `${measured}÷${hours}×${k}`,
    qHour,
    "L/h",
    "SRC-LEGACY-FULL",
  );
  return buildForwardResult(qHour, steps, {
    aggregation: "MEASURED",
    safetyFactor: k.toString(),
  });
}

export function calculateLegacyByArea(input: LegacyByAreaInput): LegacyResult {
  const area = decimal(input.areaM2, "areaM2");
  const density = decimal(input.dinerDensity, "dinerDensity");
  const turnover = decimal(input.turnover, "turnover");
  const people = area.mul(density).mul(turnover);
  const steps: CalculationStep[] = [];
  step(
    steps,
    "LEG-AREA-N",
    "n=area×dinerDensity×turnover",
    `${area}×${density}×${turnover}`,
    people,
    "person",
    "SRC-LEGACY-FULL",
  );
  const result = calculateLegacyByDiners({
    ...input,
    people,
    aggregation: "SINGLE_PERIOD",
  });
  result.methodCode = "LEGACY_BY_AREA";
  result.steps = [
    ...steps,
    ...result.steps.map((item, index) => ({ ...item, sequence: index + 2 })),
  ];
  result.metadata = {
    ...result.metadata,
    areaM2: area.toString(),
    dinerDensity: density.toString(),
    turnover: turnover.toString(),
  };
  return result;
}

export function reverseLegacyByEffectiveVolume(
  input: LegacyReverseInput,
): LegacyResult {
  const volume = decimal(input.effectiveVolumeL, "effectiveVolumeL");
  const q = decimal(input.qLitersPerPersonMeal, "qLitersPerPersonMeal");
  const t = decimal(input.operationHours, "operationHours");
  const k = validateSafetyFactor(
    input.safetyFactor,
    input.safetyClass,
    input.selectionReason,
  );
  const density = decimal(input.dinerDensity, "dinerDensity");
  const turnover = decimal(input.turnover, "turnover");
  const rawPeople = volume.mul(6).mul(t).div(q.mul(k));
  const peopleMax = rawPeople.floor();
  const rawArea = rawPeople.div(density.mul(turnover));
  const areaMax = floorTenth(rawArea);
  const steps: CalculationStep[] = [];
  step(
    steps,
    "LEG-REV-N",
    "nEquivalentMax=(6×Veff×t)/(q×k)",
    `6×${volume}×${t}÷(${q}×${k})`,
    rawPeople,
    "person",
    "SRC-LEGACY-FULL",
  );
  step(
    steps,
    "LEG-REV-A",
    "areaEquivalentMax=n/(density×turnover)",
    `${rawPeople}÷(${density}×${turnover})`,
    rawArea,
    "m²",
    "SRC-LEGACY-FULL",
  );
  return {
    track: "LEGACY_QV",
    methodCode: "LEGACY_REVERSE_BY_EFFECTIVE_VOLUME",
    semantics: `${calculationBasisDisplay.LEGACY_QV.shortLabel}計算結果：有效容積等效上限`,
    raw: {
      dinersEquivalentMax: decimalString(rawPeople),
      areaEquivalentMaxM2: decimalString(rawArea),
    },
    sourceDisplay: {},
    adopted: {
      dinersEquivalentMax: decimalString(peopleMax),
      areaEquivalentMaxM2: decimalString(areaMax),
    },
    steps,
    warnings: [
      {
        code: "HISTORICAL_METHOD",
        severity: "INFO",
        track: "LEGACY_QV",
        message: `本結果依${calculationBasisDisplay.LEGACY_QV.shortLabel}計算。`,
      },
    ],
    metadata: {
      ruleSet: "RULE-LEGACY-QV@legacy.1",
      safetyFactor: k.toString(),
    },
  };
}
