import { describe, expect, it } from "vitest";
import {
  buildDesignResults,
  buildInputGroups,
  buildInputCompletenessBadges,
  formulaValues,
} from "@/domain/report/presentation";
import type { SnapshotRun } from "@/domain/report/types";

function run(track: "CURRENT_QG" | "LEGACY_QV"): SnapshotRun {
  return {
    id: track,
    track,
    methodCode: "TEST",
    semantics: "TEST",
    inputHash: "a".repeat(64),
    raw: {},
    adopted:
      track === "CURRENT_QG"
        ? { qLpm: "60", gKg: "8" }
        : { qLph: "900", effectiveVolumeL: "150" },
    ruleSet: {
      code: "TEST",
      version: "1",
      checksum: "b".repeat(64),
      sourceCode: "TEST",
      sourceTitle: "TEST",
      sourceHash: "c".repeat(64),
    },
    steps: [],
    warnings: [],
  };
}

describe("report presentation model", () => {
  it("shows only completed-track inputs and classifies their roles", () => {
    const groups = buildInputGroups(
      {
        currentInputs: {
          kind: "DINERS",
          diningType: "CHINESE",
          people: "100",
          greaseCleaningDays: "7",
          sedimentCleaningDays: "7",
          unused: "do-not-show",
        },
        legacyInputs: {
          kind: "DINERS",
          people: "80",
          qLitersPerPersonMeal: "30",
          operationHours: "4",
          safetyFactor: "1.5",
        },
      },
      ["CURRENT_QG"],
    );

    expect(groups).toHaveLength(1);
    expect(groups[0].track).toBe("CURRENT_QG");
    expect(groups[0].rows).toContainEqual(
      expect.objectContaining({
        label: "每日用餐人數",
        value: "100",
        unit: "人/日",
        role: "案件資料",
      }),
    );
    expect(groups[0].rows.map((row) => row.value)).not.toContain("do-not-show");
  });

  it("summarizes condition completeness and structured engineering reasons", () => {
    const inputs = {
      currentInputs: {
        kind: "DINERS",
        diningType: "CHINESE",
        people: "100",
        actualUseMinutes: "480",
        greaseCleaningDays: "7",
        sedimentCleaningDays: "7",
      },
      legacyInputs: {
        kind: "DINERS",
        people: "80",
        qLitersPerPersonMeal: "30",
        operationHours: "4",
        safetyFactor: "1.5",
        selectionSourceType: "來源表範圍選值",
        selectionBasis: "依餐飲型態選用",
      },
    };

    const groups = buildInputGroups(inputs, ["CURRENT_QG", "LEGACY_QV"]);
    const badges = buildInputCompletenessBadges(
      inputs,
      ["CURRENT_QG", "LEGACY_QV"],
      "DUAL_COMPARISON",
    );

    expect(
      groups[0].rows.find((row) => row.label === "每日實際使用時間"),
    ).toMatchObject({
      role: "覆寫值",
      sourceNote: "取代來源表 t 值；需保留案件依據。",
    });
    expect(
      groups[1].rows.find((row) => row.label === "選值原因"),
    ).toMatchObject({
      value: "依餐飲型態選用",
      role: "工程選值",
    });
    expect(badges.map((badge) => badge.label)).toEqual([
      "使用特殊條件完成",
      "工程選值已記錄",
    ]);
  });

  it("keeps comparable flow units separate from non-applicable outputs", () => {
    const model = buildDesignResults(
      [run("CURRENT_QG"), run("LEGACY_QV")],
      "DUAL_COMPARISON",
    );
    const rows = model.rows;
    const normalizedFlow = rows.find((row) => row.label === "設計處理水量");
    const grease = rows.find((row) => row.label === "清除週期油脂量");
    const volume = rows.find((row) => row.label === "設備所需有效容積");

    expect(normalizedFlow?.cells.CURRENT_QG).toMatchObject({
      state: "VALUE",
      value: "60",
      unit: "L/min",
    });
    expect(normalizedFlow?.cells.LEGACY_QV).toMatchObject({
      state: "VALUE",
      value: "15",
      unit: "L/min",
    });
    expect(grease?.cells.LEGACY_QV.state).toBe("NOT_APPLICABLE");
    expect(volume?.cells.CURRENT_QG.state).toBe("NOT_APPLICABLE");
    expect(rows.some((row) => row.label === "原始設計處理水量")).toBe(false);
    expect(model.tracks).toEqual(["CURRENT_QG", "LEGACY_QV"]);
  });

  it("labels every value in a known formula substitution", () => {
    const values = formulaValues({
      sequence: 1,
      formulaCode: "LEG-DIN-Q",
      expression: "Qhour=(n×q/t)×k",
      substitution: "100×30÷5×1.5",
      result: "900",
      unit: "L/h",
      sourceRef: "TEST",
    });

    expect(values).toEqual([
      expect.objectContaining({ symbol: "n", label: "單餐期用餐人數" }),
      expect.objectContaining({ symbol: "q", unit: "L/(人·餐)" }),
      expect.objectContaining({ symbol: "t", unit: "h" }),
      expect.objectContaining({ symbol: "k", role: "計算依據參數" }),
    ]);
  });
});
