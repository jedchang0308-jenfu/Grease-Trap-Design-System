import { z } from "zod";
import {
  calculationModes,
  taskCodes,
} from "@/domain/calculation/orchestration";
import { diningTypes } from "@/domain/rules/seed-data";

const decimalValue = z.union([z.string().min(1), z.number().finite()]);
const currentBase = {
  diningType: z.enum(diningTypes),
  greaseCleaningDays: decimalValue,
  sedimentCleaningDays: decimalValue,
  actualUseMinutes: decimalValue.optional(),
};

export const currentInputSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("DINERS"), ...currentBase, people: decimalValue }),
  z.object({
    kind: z.literal("AREA"),
    ...currentBase,
    kitchenArea: decimalValue,
    diningArea: decimalValue,
  }),
  z.object({
    kind: z.literal("REVERSE"),
    ...currentBase,
    qCapacityLpm: decimalValue,
    gCapacityKg: decimalValue,
    evidenceSource: z.string().min(1),
  }),
]);

const legacyBase = {
  qLitersPerPersonMeal: decimalValue,
  operationHours: decimalValue,
  safetyFactor: decimalValue,
  safetyClass: z.enum(["A", "B", "C"]).optional(),
  selectionReason: z.string().optional(),
};

export const legacyInputSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("DINERS"),
    ...legacyBase,
    people: decimalValue.optional(),
    aggregation: z.enum(["SINGLE_PERIOD", "SOURCE_ARITHMETIC_MEAN"]).optional(),
    periods: z
      .array(
        z.object({
          label: z.string().min(1),
          people: decimalValue,
          qLitersPerPersonMeal: decimalValue.optional(),
          operationHours: decimalValue.optional(),
        }),
      )
      .optional(),
  }),
  z.object({
    kind: z.literal("AREA"),
    ...legacyBase,
    areaM2: decimalValue,
    dinerDensity: decimalValue,
    turnover: decimalValue,
  }),
  z.object({
    kind: z.literal("MEASURED"),
    measuredWastewaterL: decimalValue,
    operationHours: decimalValue,
    safetyFactor: decimalValue,
    selectionReason: z.string().optional(),
  }),
  z.object({
    kind: z.literal("REVERSE"),
    ...legacyBase,
    effectiveVolumeL: decimalValue,
    dinerDensity: decimalValue,
    turnover: decimalValue,
  }),
]);

export const createCaseSchema = z.object({
  customer: z.string().trim().min(1).max(160),
  location: z.string().trim().min(1).max(240),
  title: z.string().trim().min(1).max(160),
  purpose: z.string().trim().max(500).default(""),
  diningType: z.enum(diningTypes).optional(),
  taskCode: z.enum(taskCodes),
  mode: z.enum(calculationModes),
  evidenceSource: z.string().trim().max(500).optional(),
});

export const calculateRequestSchema = z.object({
  caseId: z.string().uuid(),
  revisionNo: z.number().int().positive(),
  taskCode: z.enum(taskCodes),
  mode: z.enum(calculationModes),
  idempotencyKey: z.string().trim().min(8).max(160),
  expectedCaseVersion: z.number().int().positive(),
  requestedRuleSetVersion: z.string().optional(),
  currentInputs: currentInputSchema.optional(),
  legacyInputs: legacyInputSchema.optional(),
});

export const patchCaseSchema = z.object({
  customer: z.string().trim().min(1).max(160).optional(),
  location: z.string().trim().min(1).max(240).optional(),
  title: z.string().trim().min(1).max(160).optional(),
  purpose: z.string().trim().max(500).optional(),
  expectedCaseVersion: z.number().int().positive(),
});
