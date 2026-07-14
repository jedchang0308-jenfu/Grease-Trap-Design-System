import { describe, expect, it } from "vitest";
import { createCaseSchema } from "@/application/cases/schemas";

describe("createCaseSchema", () => {
  it("accepts a case with no optional basic metadata", () => {
    const result = createCaseSchema.parse({
      taskCode: "T02_DINERS_TO_DESIGN",
      mode: "CURRENT_QG",
    });

    expect(result).toMatchObject({
      customer: "",
      location: "",
      title: "",
      purpose: "",
    });
  });

  it("accepts blank values submitted by the browser form", () => {
    const result = createCaseSchema.safeParse({
      customer: "",
      location: "",
      title: "",
      purpose: "",
      evidenceSource: "",
      taskCode: "T04_AREA_TO_DESIGN",
      mode: "DUAL_COMPARISON",
    });

    expect(result.success).toBe(true);
  });
});
