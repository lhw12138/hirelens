import { describe, expect, it } from "vitest";
import { evidenceCoverage, reciprocalRankFusion } from "./retrieval";

describe("hybrid retrieval", () => {
  it("rewards candidates retrieved by both channels", () => {
    const result = reciprocalRankFusion(
      [{ id: "both", keywordScore: 0.9, vectorScore: 0 }, { id: "keyword", keywordScore: 0.8, vectorScore: 0 }],
      [{ id: "both", keywordScore: 0, vectorScore: 0.92 }, { id: "vector", keywordScore: 0, vectorScore: 0.9 }],
    );
    expect(result[0].id).toBe("both");
  });

  it("measures required competency coverage", () => {
    expect(evidenceCoverage(["a", "b", "c"], ["a", "c", "c"])).toBeCloseTo(2 / 3);
  });
});
