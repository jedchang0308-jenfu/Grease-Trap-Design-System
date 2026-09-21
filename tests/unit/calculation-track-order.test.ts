import { describe, expect, it } from "vitest";
import { presentRuleSets } from "@/domain/rules/catalog";
import {
  calculationTrackOrder,
  calculationTracksForMode,
} from "@/domain/rules/source-display";

describe("calculation track display order", () => {
  it("uses algorithm A before algorithm B for dual-track displays", () => {
    expect(calculationTrackOrder).toEqual(["LEGACY_QV", "CURRENT_QG"]);
    expect(calculationTracksForMode("DUAL_COMPARISON")).toEqual([
      "LEGACY_QV",
      "CURRENT_QG",
    ]);
    expect(presentRuleSets().map((rule) => rule.methodFamily)).toEqual([
      "LEGACY_QV",
      "CURRENT_QG",
    ]);
  });
});
