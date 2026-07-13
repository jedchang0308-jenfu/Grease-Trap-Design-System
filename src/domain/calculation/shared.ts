import Decimal from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type Track = "CURRENT_QG" | "LEGACY_QV";

export interface CalculationStep {
  sequence: number;
  formulaCode: string;
  expression: string;
  substitution: string;
  result: string;
  unit: string;
  sourceRef: string;
}

export interface Warning {
  code: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  track: Track;
  message: string;
  details?: Record<string, unknown>;
}

export class DomainInputError extends Error {
  constructor(
    message: string,
    public readonly fields: string[] = [],
  ) {
    super(message);
  }
}

export function decimal(value: Decimal.Value, field: string): Decimal {
  let parsed: Decimal;
  try {
    parsed = new Decimal(value);
  } catch {
    throw new DomainInputError(`${field} 必須是有效數值。`, [field]);
  }
  if (!parsed.isFinite() || parsed.lte(0))
    throw new DomainInputError(`${field} 必須大於 0。`, [field]);
  return parsed;
}

export function assertRange(
  value: Decimal,
  min: number,
  max: number,
  field: string,
) {
  if (value.lt(min) || value.gt(max)) {
    throw new DomainInputError(`${field} 必須介於 ${min} 與 ${max}。`, [field]);
  }
}

export function ceilTenth(value: Decimal): Decimal {
  return value.mul(10).ceil().div(10);
}

export function floorTenth(value: Decimal): Decimal {
  return value.mul(10).floor().div(10);
}

export function sourceDisplayTenth(value: Decimal): Decimal {
  return floorTenth(value);
}

export function decimalString(value: Decimal): string {
  return value.toSignificantDigits(36).toString();
}

export function step(
  steps: CalculationStep[],
  formulaCode: string,
  expression: string,
  substitution: string,
  result: Decimal,
  unit: string,
  sourceRef: string,
) {
  steps.push({
    sequence: steps.length + 1,
    formulaCode,
    expression,
    substitution,
    result: decimalString(result),
    unit,
    sourceRef,
  });
}
