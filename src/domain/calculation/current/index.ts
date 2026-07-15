import Decimal from "decimal.js";
import { calculationBasisDisplay } from "@/domain/rules/source-display";
import {
  a36Areas,
  currentAreaFactors,
  currentDinerFactors,
  currentN0Table,
  currentSeatUtilization,
  type DiningType,
} from "@/domain/rules/seed-data";
import {
  assertRange,
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

export interface CurrentBaseInput {
  diningType: DiningType;
  greaseCleaningDays: Decimal.Value;
  sedimentCleaningDays: Decimal.Value;
  actualUseMinutes?: Decimal.Value;
}

export interface CurrentByDinersInput extends CurrentBaseInput {
  people: Decimal.Value;
}

export interface CurrentByAreaInput extends CurrentBaseInput {
  kitchenArea: Decimal.Value;
  diningArea: Decimal.Value;
}

export interface CurrentCapacityInput extends CurrentBaseInput {
  qCapacityLpm: Decimal.Value;
  gCapacityKg: Decimal.Value;
  evidenceSource: string;
}

export interface CurrentResult {
  track: "CURRENT_QG";
  methodCode:
    | "CURRENT_BY_DINERS"
    | "CURRENT_BY_TOTAL_AREA"
    | "CURRENT_REVERSE_BY_CAPACITY";
  semantics: string;
  raw: Record<string, string | null>;
  sourceDisplay: Record<string, string | null>;
  adopted: Record<string, string | null>;
  controllingCondition?: "Q" | "G" | "Q_AND_G";
  steps: CalculationStep[];
  warnings: Warning[];
  metadata: Record<string, unknown>;
}

export interface N0Resolution {
  value: Decimal;
  state: "EXACT" | "INTERPOLATED" | "SOURCE_EXCEPTION";
  lowerArea?: number;
  upperArea?: number;
}

function validateBase(input: CurrentBaseInput) {
  const iu = decimal(input.greaseCleaningDays, "greaseCleaningDays");
  const ib = decimal(input.sedimentCleaningDays, "sedimentCleaningDays");
  assertRange(iu, 7, 14, "greaseCleaningDays");
  assertRange(ib, 7, 30, "sedimentCleaningDays");
  return { iu, ib };
}

export function resolveN0(
  diningType: DiningType,
  areaValue: Decimal.Value,
): N0Resolution {
  const area = decimal(areaValue, "totalArea");
  if (diningType === "CHINESE" && area.eq(610)) {
    return { value: new Decimal("3.4"), state: "SOURCE_EXCEPTION" };
  }

  const row = currentN0Table[diningType];
  if (!row)
    throw new DomainInputError("此餐飲類型沒有 A-36 面積補正資料。", [
      "diningType",
    ]);

  const exactIndex = a36Areas.findIndex((point) => area.eq(point));
  if (exactIndex >= 0) {
    const exact = row[exactIndex];
    if (exact === null)
      throw new DomainInputError("所選面積落在 A-36 無來源數值區間。", [
        "totalArea",
      ]);
    return { value: new Decimal(exact), state: "EXACT" };
  }

  for (let index = 0; index < a36Areas.length - 1; index += 1) {
    const lowerArea = a36Areas[index];
    const upperArea = a36Areas[index + 1];
    if (!area.gt(lowerArea) || !area.lt(upperArea)) continue;
    const lower = row[index];
    const upper = row[index + 1];
    if (lower === null || upper === null) {
      throw new DomainInputError("所選面積不可跨 A-36 空白或破折號區間內插。", [
        "totalArea",
      ]);
    }
    const ratio = area.minus(lowerArea).div(upperArea - lowerArea);
    return {
      value: new Decimal(lower).plus(
        new Decimal(upper).minus(lower).mul(ratio),
      ),
      state: "INTERPOLATED",
      lowerArea,
      upperArea,
    };
  }
  throw new DomainInputError("所選面積超出 A-36 可用來源範圍。", ["totalArea"]);
}

export function calculateCurrentByDiners(
  input: CurrentByDinersInput,
): CurrentResult {
  const factors = currentDinerFactors[input.diningType];
  if (!factors)
    throw new DomainInputError("此餐飲類型沒有人數法參數。", ["diningType"]);
  const { iu, ib } = validateBase(input);
  const people = decimal(input.people, "people");
  const t = input.actualUseMinutes
    ? decimal(input.actualUseMinutes, "actualUseMinutes")
    : new Decimal(factors.t);
  const wm = new Decimal(factors.WmPrime);
  const k = new Decimal(factors.k);
  const gu = new Decimal(factors.gu);
  const gb = new Decimal(factors.gb);
  const q = people.mul(wm).div(t).mul(k);
  const guLoad = people.mul(gu).mul(iu).div(1000);
  const gbLoad = people.mul(gb).mul(ib).div(1000);
  const g = guLoad.plus(gbLoad);
  const steps: CalculationStep[] = [];
  step(
    steps,
    "CUR-DIN-Q",
    "Q=N×Wm'×(1/t)×k",
    `${people}×${wm}÷${t}×${k}`,
    q,
    "L/min",
    "A-37",
  );
  step(
    steps,
    "CUR-DIN-GU",
    "Gu=(1/1000)×N×gu×iu",
    `${people}×${gu}×${iu}÷1000`,
    guLoad,
    "kg",
    "A-37",
  );
  step(
    steps,
    "CUR-DIN-GB",
    "Gb=(1/1000)×N×gb×ib",
    `${people}×${gb}×${ib}÷1000`,
    gbLoad,
    "kg",
    "A-37",
  );
  step(steps, "CUR-DIN-G", "G=Gu+Gb", `${guLoad}+${gbLoad}`, g, "kg", "A-37");
  return {
    track: "CURRENT_QG",
    methodCode: "CURRENT_BY_DINERS",
    semantics: `${calculationBasisDisplay.CURRENT_QG.shortLabel}計算結果`,
    raw: { qLpm: decimalString(q), gKg: decimalString(g) },
    sourceDisplay: {
      qLpm: decimalString(sourceDisplayTenth(q)),
      gKg: decimalString(sourceDisplayTenth(g)),
    },
    adopted: {
      qLpm: decimalString(ceilTenth(q)),
      gKg: decimalString(ceilTenth(g)),
    },
    steps,
    warnings: [],
    metadata: {
      diningType: input.diningType,
      ruleSet: "RULE-CURRENT-QG@2020.1",
    },
  };
}

export function calculateCurrentByArea(
  input: CurrentByAreaInput,
): CurrentResult {
  const factors = currentAreaFactors[input.diningType];
  const nValue = currentSeatUtilization[input.diningType];
  if (!factors || !nValue)
    throw new DomainInputError("此餐飲類型沒有完整面積法參數。", [
      "diningType",
    ]);
  const { iu, ib } = validateBase(input);
  const kitchenArea = decimal(input.kitchenArea, "kitchenArea");
  const diningArea = decimal(input.diningArea, "diningArea");
  const area = kitchenArea.plus(diningArea);
  const n0 = resolveN0(input.diningType, area);
  const n = new Decimal(nValue);
  const t = input.actualUseMinutes
    ? decimal(input.actualUseMinutes, "actualUseMinutes")
    : new Decimal(factors.t);
  const wm = new Decimal(factors.Wm);
  const k = new Decimal(factors.k);
  const gu = new Decimal(factors.gu);
  const gb = new Decimal(factors.gb);
  const q = area.mul(wm).mul(n.div(n0.value)).div(t).mul(k);
  const guLoad = area.mul(gu).mul(n.div(n0.value)).mul(iu).div(1000);
  const gbLoad = area.mul(gb).mul(n.div(n0.value)).mul(ib).div(1000);
  const g = guLoad.plus(gbLoad);
  const steps: CalculationStep[] = [];
  step(
    steps,
    "CUR-AREA-A",
    "A=kitchenArea+diningArea",
    `${kitchenArea}+${diningArea}`,
    area,
    "m²",
    "case-input",
  );
  step(
    steps,
    "CUR-AREA-Q",
    "Q=A×Wm×(n/n0)×(1/t)×k",
    `${area}×${wm}×(${n}/${n0.value})÷${t}×${k}`,
    q,
    "L/min",
    "A-34～A-36",
  );
  step(
    steps,
    "CUR-AREA-GU",
    "Gu=(1/1000)×A×gu×(n/n0)×iu",
    `${area}×${gu}×(${n}/${n0.value})×${iu}÷1000`,
    guLoad,
    "kg",
    "A-34～A-36",
  );
  step(
    steps,
    "CUR-AREA-GB",
    "Gb=(1/1000)×A×gb×(n/n0)×ib",
    `${area}×${gb}×(${n}/${n0.value})×${ib}÷1000`,
    gbLoad,
    "kg",
    "A-34～A-36",
  );
  step(
    steps,
    "CUR-AREA-G",
    "G=Gu+Gb",
    `${guLoad}+${gbLoad}`,
    g,
    "kg",
    "A-34～A-36",
  );
  const warnings: Warning[] = [];
  if (n0.state === "SOURCE_EXCEPTION") {
    warnings.push({
      code: "SOURCE_EXCEPTION",
      severity: "WARNING",
      track: "CURRENT_QG",
      message:
        "A=610 m² 採官方案例的 n0=3.4 精確來源例外；不得外推至其他面積。",
    });
  }
  return {
    track: "CURRENT_QG",
    methodCode: "CURRENT_BY_TOTAL_AREA",
    semantics: `${calculationBasisDisplay.CURRENT_QG.shortLabel}計算結果`,
    raw: {
      qLpm: decimalString(q),
      gKg: decimalString(g),
      totalAreaM2: decimalString(area),
      n0: decimalString(n0.value),
    },
    sourceDisplay: {
      qLpm: decimalString(sourceDisplayTenth(q)),
      gKg: decimalString(sourceDisplayTenth(g)),
    },
    adopted: {
      qLpm: decimalString(ceilTenth(q)),
      gKg: decimalString(ceilTenth(g)),
    },
    steps,
    warnings,
    metadata: {
      diningType: input.diningType,
      n0State: n0.state,
      ruleSet: "RULE-CURRENT-QG@2020.1",
    },
  };
}

export function reverseCurrentByCapacity(
  input: CurrentCapacityInput,
): CurrentResult {
  if (!input.evidenceSource.trim())
    throw new DomainInputError("反推必須填寫設備能力資料來源。", [
      "evidenceSource",
    ]);
  const factors = currentDinerFactors[input.diningType];
  const areaFactors = currentAreaFactors[input.diningType];
  const nValue = currentSeatUtilization[input.diningType];
  if (!factors || !areaFactors || !nValue)
    throw new DomainInputError("此餐飲類型沒有完整反推參數。", ["diningType"]);
  const { iu, ib } = validateBase(input);
  const qCapacity = decimal(input.qCapacityLpm, "qCapacityLpm");
  const gCapacity = decimal(input.gCapacityKg, "gCapacityKg");
  const dinerT = input.actualUseMinutes
    ? decimal(input.actualUseMinutes, "actualUseMinutes")
    : new Decimal(factors.t);
  const nByQ = qCapacity
    .mul(dinerT)
    .div(new Decimal(factors.WmPrime).mul(factors.k));
  const nByG = gCapacity
    .mul(1000)
    .div(new Decimal(factors.gu).mul(iu).plus(new Decimal(factors.gb).mul(ib)));
  const dinerMin = Decimal.min(nByQ, nByG);
  const dinerMax = dinerMin.ceil().eq(dinerMin)
    ? dinerMin.minus(1).floor()
    : dinerMin.floor();

  let areaMax: Decimal | null = null;
  let areaQ: Decimal | null = null;
  let areaG: Decimal | null = null;
  const areaT = input.actualUseMinutes
    ? decimal(input.actualUseMinutes, "actualUseMinutes")
    : new Decimal(areaFactors.t);
  const n = new Decimal(nValue);
  for (let tenth = 1; tenth <= 15000; tenth += 1) {
    const area = new Decimal(tenth).div(10);
    let n0: N0Resolution;
    try {
      n0 = resolveN0(input.diningType, area);
    } catch {
      continue;
    }
    const q = area
      .mul(areaFactors.Wm)
      .mul(n.div(n0.value))
      .div(areaT)
      .mul(areaFactors.k);
    const g = area
      .mul(n.div(n0.value))
      .mul(
        new Decimal(areaFactors.gu)
          .mul(iu)
          .plus(new Decimal(areaFactors.gb).mul(ib)),
      )
      .div(1000);
    if (q.lt(qCapacity) && g.lt(gCapacity)) {
      areaMax = area;
      areaQ = q;
      areaG = g;
    }
  }

  const qControlsDiners = nByQ.lt(nByG);
  const gControlsDiners = nByG.lt(nByQ);
  const controllingCondition = qControlsDiners
    ? "Q"
    : gControlsDiners
      ? "G"
      : "Q_AND_G";
  const steps: CalculationStep[] = [];
  step(
    steps,
    "CUR-REV-N-Q",
    "N_by_Q=Qcapacity×t/(Wm'×k)",
    `${qCapacity}×${dinerT}÷(${factors.WmPrime}×${factors.k})`,
    nByQ,
    "person",
    "A-37",
  );
  step(
    steps,
    "CUR-REV-N-G",
    "N_by_G=1000×Gcapacity/(gu×iu+gb×ib)",
    `1000×${gCapacity}÷(${factors.gu}×${iu}+${factors.gb}×${ib})`,
    nByG,
    "person",
    "A-37",
  );
  if (areaMax && areaQ && areaG) {
    step(
      steps,
      "CUR-REV-A",
      "piecewise A-36 strict solver",
      `Q(A)<${qCapacity} and G(A)<${gCapacity}`,
      areaMax,
      "m²",
      "A-34～A-36",
    );
  }
  return {
    track: "CURRENT_QG",
    methodCode: "CURRENT_REVERSE_BY_CAPACITY",
    semantics: `${calculationBasisDisplay.CURRENT_QG.shortLabel}計算結果：設備能力等效上限`,
    raw: {
      dinersByQ: decimalString(nByQ),
      dinersByG: decimalString(nByG),
      dinersEquivalentMax: decimalString(dinerMax),
      areaEquivalentMaxM2: areaMax ? decimalString(areaMax) : null,
      qAtAreaMaxLpm: areaQ ? decimalString(areaQ) : null,
      gAtAreaMaxKg: areaG ? decimalString(areaG) : null,
    },
    sourceDisplay: {},
    adopted: {
      dinersEquivalentMax: decimalString(dinerMax),
      areaEquivalentMaxM2: areaMax ? decimalString(floorTenth(areaMax)) : null,
    },
    controllingCondition,
    steps,
    warnings: [
      {
        code: "CAPACITY_SOURCE_NOT_VERIFIED",
        severity: "INFO",
        track: "CURRENT_QG",
        message: "系統依輸入能力反推，未驗證特定產品或證書符合性。",
        details: { evidenceSource: input.evidenceSource },
      },
    ],
    metadata: {
      diningType: input.diningType,
      evidenceSource: input.evidenceSource,
      strictComparison: true,
      ruleSet: "RULE-CURRENT-QG@2020.1",
    },
  };
}

export function calculateCurrentCompositeByDiners(
  candidates: CurrentByDinersInput[],
): { selected: CurrentResult; candidates: CurrentResult[] } {
  if (!candidates.length)
    throw new DomainInputError("複合餐飲至少需要一個候選類型。", [
      "candidates",
    ]);
  const results = candidates.map(calculateCurrentByDiners);
  const selected = results.reduce((best, candidate) => {
    const bestQ = new Decimal(best.raw.qLpm!);
    const candidateQ = new Decimal(candidate.raw.qLpm!);
    const bestG = new Decimal(best.raw.gKg!);
    const candidateG = new Decimal(candidate.raw.gKg!);
    return candidateQ.gt(bestQ) || candidateG.gt(bestG) ? candidate : best;
  });
  return { selected, candidates: results };
}
