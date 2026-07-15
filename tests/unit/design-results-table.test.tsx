import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DesignResultsTable } from "@/ui/components/design-results-table";

describe("DesignResultsTable", () => {
  it("uses the report result model and unified comparison units", () => {
    const html = renderToStaticMarkup(
      <DesignResultsTable
        mode="DUAL_COMPARISON"
        runs={[
          {
            track: "CURRENT_QG",
            adopted: { qLpm: "21.9", gKg: "2.8" },
          },
          {
            track: "LEGACY_QV",
            adopted: { qLph: "900", effectiveVolumeL: "150" },
          },
        ]}
      />,
    );

    expect(html).toContain('aria-label="本次設計結果"');
    expect(html).toContain("設計處理水量");
    expect(html).toContain('15</strong><span class="design-result-unit">L/min');
    expect(html).toContain("此依據無法計算");
    expect(html).not.toContain("900</strong>");
  });
});
