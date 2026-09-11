import { describe, expect, it } from "vitest";
import { chooseBlindReviewCases, compareBlindReview, type BlindReviewAnswer } from "./blind-review";
import { buildSyntheticEvalDataset } from "./eval-fixtures";

const answers: Record<string, BlindReviewAnswer> = {
  a: { status: "supported", score: 62, sourceIds: ["a1"], reason: "有具体行动", savedAt: "2026-09-08T00:00:00Z" },
  b: { status: "insufficient", score: null, sourceIds: [], reason: "只有自评", savedAt: "2026-09-08T00:00:00Z" },
};

describe("compareBlindReview", () => {
  it("compares status, score and exact citation choices", () => {
    expect(compareBlindReview(["a", "b"], answers, [
      { caseId: "a", status: "supported", score: 68, sourceIds: ["a1"], claim: "" },
      { caseId: "b", status: "supported", score: 20, sourceIds: ["b1"], claim: "" },
    ])).toEqual({ comparedCases: 2, statusAgreement: 50, citationAgreement: 50, averageScoreDifference: 6, disagreementCaseIds: ["b"] });
  });

  it("does not invent score differences when no numeric pair exists", () => {
    expect(compareBlindReview(["b"], answers, [{ caseId: "b", status: "insufficient", score: null, sourceIds: [], claim: "" }]).averageScoreDifference).toBeNull();
  });

  it("selects 20 unique cases with two variants per pattern and balanced roles", () => {
    const fixtures=buildSyntheticEvalDataset(),ids=chooseBlindReviewCases(fixtures,20,()=>.42),selected=fixtures.filter(item=>ids.includes(item.id));
    expect(new Set(ids).size).toBe(20);
    const titles=Object.values(Object.groupBy(selected,item=>item.title)).map(items=>items?.length);
    expect(titles).toEqual(expect.arrayContaining(Array(10).fill(2)));
    const roleCounts=Object.values(Object.groupBy(selected,item=>item.role)).map(items=>items?.length||0);
    expect(Math.max(...roleCounts)-Math.min(...roleCounts)).toBeLessThanOrEqual(1);
  });

  it("uses different risk evidence for every role", () => {
    const risky=buildSyntheticEvalDataset().filter(item=>["missing","conflict","exaggeration","boundary"].includes(item.scenario)&&item.sources.length);
    const texts=risky.flatMap(item=>item.sources.map(source=>source.text));
    expect(new Set(texts).size).toBe(texts.length);
  });
});
