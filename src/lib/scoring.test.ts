import { describe, expect, it } from "vitest";
import { calculateWeightedScore, canConfirmAssessment } from "./scoring";

describe("assessment scoring", () => {
  const competencies = [
    { id: "a", name: "A", weight: 60, description: "", mustHave: true },
    { id: "b", name: "B", weight: 40, description: "", mustHave: false },
  ];

  it("applies HR adjustments on the shared scale", () => {
    expect(calculateWeightedScore(competencies, [
      { competencyId: "a", aiScore: 80, hrAdjustment: 5, evidenceCount: 2, status: "grounded", claim: "" },
      { competencyId: "b", aiScore: 70, hrAdjustment: -5, evidenceCount: 2, status: "grounded", claim: "" },
    ])).toBe(77);
  });

  it("blocks confirmation while conflicts remain", () => {
    expect(canConfirmAssessment([
      { competencyId: "a", aiScore: 80, hrAdjustment: 0, evidenceCount: 1, status: "conflict", claim: "" },
    ])).toBe(false);
  });
});
