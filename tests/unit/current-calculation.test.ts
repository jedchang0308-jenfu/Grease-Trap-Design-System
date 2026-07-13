import { describe, expect, it } from "vitest";
import Decimal from "decimal.js";
import {
  calculateCurrentByArea,
  calculateCurrentByDiners,
  resolveN0,
  reverseCurrentByCapacity,
} from "@/domain/calculation/current";

describe("current Q/G official regression", () => {
  it("recalculates CUR-DIN-001 with raw and adopted values", () => {
    const result = calculateCurrentByDiners({
      diningType: "CHINESE",
      people: "1000",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    });
    expect(
      new Decimal(result.raw.qLpm!)
        .minus("388.8888888888888888888888888888888888889")
        .abs()
        .lt("1e-32"),
    ).toBe(true);
    expect(result.raw.gKg).toBe("112");
    expect(result.adopted.qLpm).toBe("388.9");
    expect(result.adopted.gKg).toBe("112");
  });

  it("recalculates CUR-SCHOOL-001", () => {
    const result = calculateCurrentByDiners({
      diningType: "SCHOOL_LUNCH",
      people: "2150",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    });
    expect(result.raw.qLpm).toBe("235.15625");
    expect(result.raw.gKg).toBe("15.05");
    expect(result.adopted.qLpm).toBe("235.2");
    expect(result.adopted.gKg).toBe("15.1");
  });

  it("uses only the exact 610 m2 source exception", () => {
    const result = calculateCurrentByArea({
      diningType: "CHINESE",
      kitchenArea: "210",
      diningArea: "400",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    });
    expect(result.raw.qLpm).toMatch(/^566\.891339869281/);
    expect(result.raw.gKg).toMatch(/^163\.264705882352/);
    expect(result.adopted.qLpm).toBe("566.9");
    expect(result.adopted.gKg).toBe("163.3");
    expect(result.warnings.map((warning) => warning.code)).toContain(
      "SOURCE_EXCEPTION",
    );
    expect(() => resolveN0("CHINESE", "609.9")).toThrow(/空白|來源範圍/);
    expect(() => resolveN0("CHINESE", "610.1")).toThrow(/空白|來源範圍/);
  });

  it("interpolates only between adjacent numeric points", () => {
    expect(resolveN0("WESTERN", "112.5").value.toString()).toBe("2.05");
    expect(() => resolveN0("WESTERN", "90")).toThrow(/空白|破折號/);
    expect(() => resolveN0("JAPANESE", "450")).toThrow(/空白|破折號/);
  });

  it("keeps reverse capacity comparisons strict", () => {
    const forward = calculateCurrentByDiners({
      diningType: "CHINESE",
      people: "100",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    });
    const reverse = reverseCurrentByCapacity({
      diningType: "CHINESE",
      qCapacityLpm: forward.raw.qLpm!,
      gCapacityKg: forward.raw.gKg!,
      evidenceSource: "QA fixture",
      greaseCleaningDays: "7",
      sedimentCleaningDays: "7",
    });
    expect(reverse.adopted.dinersEquivalentMax).toBe("99");
  });
});
