import { describe, expect, it } from "vitest";
import { calculateMissingRevisionNos } from "@/application/cases/history-service";
import { historicalReportFileName } from "@/application/reports/historical-report-service";
import type { CaseRecord } from "@/infrastructure/data/case-store";

function record(revisionNo: number): CaseRecord {
  return { revision_no: revisionNo } as CaseRecord;
}

describe("case history presentation helpers", () => {
  it("identifies gaps between the current revision and archived revisions", () => {
    expect(
      calculateMissingRevisionNos(record(5), [record(4), record(2)]),
    ).toEqual([1, 3]);
    expect(calculateMissingRevisionNos(record(1), [])).toEqual([]);
  });

  it("makes historical PDF provenance visible in the filename", () => {
    expect(historicalReportFileName("GTC-260921-02", 1)).toBe(
      "GTC-260921-02-R01-REGENERATED.pdf",
    );
    expect(historicalReportFileName("GTC-260921-02", 12)).toBe(
      "GTC-260921-02-R12-REGENERATED.pdf",
    );
  });
});
