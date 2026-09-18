import { describe, expect, it } from "vitest";
import {
  calculateLegacyByArea,
  calculateLegacyByDiners,
  calculateLegacyFlowByEffectiveVolume,
  calculateLegacyMeasured,
  reverseLegacyByEffectiveVolume,
} from "@/domain/calculation/legacy";

describe("legacy Q/V source regression", () => {
  it("recalculates LEG-MEAL-001 instead of copying 178.1", () => {
    const result = calculateLegacyByDiners({
      aggregation: "SOURCE_ARITHMETIC_MEAN",
      qLitersPerPersonMeal: "50",
      operationHours: "4",
      safetyFactor: "1.5",
      periods: [
        {
          label: "午餐",
          people: "50",
          qLitersPerPersonMeal: "50",
          operationHours: "4",
        },
        {
          label: "晚餐",
          people: "80",
          qLitersPerPersonMeal: "50",
          operationHours: "5",
        },
      ],
    });
    expect(result.raw.qLph).toBe("1068.75");
    expect(result.raw.effectiveVolumeL).toBe("178.125");
    expect(result.adopted.effectiveVolumeL).toBe("178.2");
  });

  it("recalculates the school example with the omitted zero restored", () => {
    const result = calculateLegacyByDiners({
      people: "1500",
      qLitersPerPersonMeal: "100",
      operationHours: "10",
      safetyFactor: "1.3",
    });
    expect(result.raw.qLph).toBe("19500");
    expect(result.raw.effectiveVolumeL).toBe("3250");
  });

  it("calculates measured and area source examples", () => {
    const measured = calculateLegacyMeasured({
      measuredWastewaterL: "2000",
      operationHours: "4",
      safetyFactor: "1.2",
    });
    expect(measured.raw.qLph).toBe("600");
    expect(measured.raw.effectiveVolumeL).toBe("100");

    const area = calculateLegacyByArea({
      areaM2: "200",
      dinerDensity: "0.5",
      turnover: "8",
      qLitersPerPersonMeal: "30",
      operationHours: "12",
      safetyFactor: "1.5",
    });
    expect(area.raw.qLph).toBe("3000");
    expect(area.raw.effectiveVolumeL).toBe("500");
  });

  it("requires an exact B/C safety factor reason", () => {
    expect(() =>
      calculateLegacyByDiners({
        people: "100",
        qLitersPerPersonMeal: "30",
        operationHours: "5",
        safetyFactor: "1.3",
        safetyClass: "B",
      }),
    ).toThrow(/理由/);
  });

  it("rounds reverse results down", () => {
    const result = reverseLegacyByEffectiveVolume({
      effectiveVolumeL: "500",
      qLitersPerPersonMeal: "30",
      operationHours: "12",
      safetyFactor: "1.5",
      dinerDensity: "0.5",
      turnover: "8",
    });
    expect(result.adopted.dinersEquivalentMax).toBe("800");
    expect(result.adopted.areaEquivalentMaxM2).toBe("200");
  });

  it("converts effective volume into design flow with the source coefficient", () => {
    const result = calculateLegacyFlowByEffectiveVolume({
      effectiveVolumeL: "500",
      evidenceSource: "設備圖面 A-01",
    });

    expect(result.methodCode).toBe("LEGACY_FLOW_BY_EFFECTIVE_VOLUME");
    expect(result.raw.qLph).toBe("3000");
    expect(result.raw.qLpm).toBe("50");
    expect(result.steps.map((item) => item.formulaCode)).toEqual([
      "LEG-VOL-QH",
      "LEG-VOL-QM",
    ]);
  });
});
