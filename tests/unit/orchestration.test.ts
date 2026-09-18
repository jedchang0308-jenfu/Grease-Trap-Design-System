import { describe, expect, it } from "vitest";
import {
  deriveCaseStatus,
  orchestrateCalculation,
  type TrackStatus,
} from "@/domain/calculation/orchestration";

describe("dual track release matrix", () => {
  const matrix: Array<[TrackStatus, TrackStatus, string, boolean]> = [
    ["CALCULATED", "CALCULATED", "COMPLETE", true],
    ["CALCULATED", "INSUFFICIENT_DATA", "COMPLETE_WITH_REMINDER", true],
    ["INSUFFICIENT_DATA", "CALCULATED", "COMPLETE_WITH_REMINDER", true],
    ["CALCULATED", "ERROR", "COMPLETE_WITH_REMINDER", true],
    ["INVALID", "CALCULATED", "COMPLETE_WITH_REMINDER", true],
    ["INSUFFICIENT_DATA", "INVALID", "BLOCKED", false],
    ["ERROR", "ERROR", "BLOCKED", false],
  ];

  it.each(matrix)(
    "derives %s + %s as %s",
    (current, legacy, status, releaseEligible) => {
      const actual = deriveCaseStatus("DUAL_COMPARISON", [current, legacy]);
      expect(actual).toBe(status);
      expect(actual !== "BLOCKED").toBe(releaseEligible);
    },
  );

  it("does not create a fake result for a missing track", () => {
    const result = orchestrateCalculation({
      taskCode: "T02_DINERS_TO_DESIGN",
      mode: "DUAL_COMPARISON",
      currentInputs: {
        kind: "DINERS",
        diningType: "CHINESE",
        people: "1000",
        greaseCleaningDays: "7",
        sedimentCleaningDays: "7",
      },
    });
    expect(result.status).toBe("COMPLETE_WITH_REMINDER");
    expect(result.releaseEligible).toBe(true);
    expect(result.results.CURRENT_QG).toBeDefined();
    expect(result.results.LEGACY_QV).toBeUndefined();
    expect(
      result.trackAssessments.find((item) => item.track === "LEGACY_QV")
        ?.status,
    ).toBe("INSUFFICIENT_DATA");
  });

  it("runs the effective-volume-to-flow task on the legacy track", () => {
    const result = orchestrateCalculation({
      taskCode: "T06_EFFECTIVE_VOLUME_TO_FLOW",
      mode: "LEGACY_QV",
      legacyInputs: {
        kind: "VOLUME_TO_FLOW",
        effectiveVolumeL: "500",
        evidenceSource: "設備圖面 A-01",
      },
    });

    expect(result.status).toBe("COMPLETE");
    expect(result.results.LEGACY_QV?.adopted.qLph).toBe("3000");
  });
});
