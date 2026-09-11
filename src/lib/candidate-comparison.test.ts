import { describe, expect, it } from "vitest";
import { comparisonReport, comparisonTotal, hardRequirementResult, rankCandidates } from "./candidate-comparison";
import type { Assessment, HiringTask, Person } from "./workflow";

const criteria = [{ id: "core", name: "核心能力", description: "核对行动和结果", weight: 70 }, { id: "delivery", name: "交付", description: "核对交付证据", weight: 30 }];
const assessment = (a: number | null, b: number | null): Assessment => ({ summary: "这是足够长度的候选人评估摘要。", scores: [{ criterionId: "core", score: a, claim: "依据", sourceIds: [], status: a === null ? "conflict" : "supported" }, { criterionId: "delivery", score: b, claim: "依据", sourceIds: [], status: b !== null && b <= 24 ? "insufficient" : "supported" }], conflicts: [], model: "test", latencyMs: 1, inputTokens: 1, outputTokens: 1, createdAt: "2026-09-10T00:00:00.000Z" });
const person = (id: string, score: Assessment): Person => ({ id, name: id, synthetic: true, filename: "test.pdf", resume: "合成测试简历正文足够长。", resumeConfirmed: true, sources: [], questions: [], answers: {}, interviewComplete: true, screening: score, assessment: score });

describe("candidate comparison", () => {
  it("includes low-confidence numeric scores in the total", () => expect(comparisonTotal(person("A", assessment(80, 20)), criteria, "combined")).toBe(62));
  it("keeps a conflict out of ranking", () => expect(comparisonTotal(person("A", assessment(null, 80)), criteria, "combined")).toBeNull());
  it("sorts scored candidates before candidates needing verification", () => expect(rankCandidates([person("C", assessment(null, 10)), person("B", assessment(60, 50)), person("A", assessment(90, 80))], criteria, "combined").map((item) => item.id)).toEqual(["A", "B", "C"]));
  it("groups an unmet hard requirement behind a lower total that passes", () => {
    const gated = [{ ...criteria[0], mustHave: true, minimumScore: 60 }, criteria[1]];
    expect(rankCandidates([person("high-total-but-fails", assessment(55, 100)), person("passes", assessment(62, 20))], gated, "combined").map((item) => item.id)).toEqual(["passes", "high-total-but-fails"]);
    expect(hardRequirementResult(person("fails", assessment(55, 100)), gated, "combined").state).toBe("unmet");
  });
  it("does not turn missing hard-requirement evidence into automatic failure", () => {
    const gated = [{ ...criteria[0], mustHave: true, minimumScore: 60 }, criteria[1]];
    expect(hardRequirementResult(person("unknown", assessment(null, 80)), gated, "combined").state).toBe("verify");
  });
  it("uses the HR-confirmed score for combined hard-requirement status", () => {
    const gated = [{ ...criteria[0], mustHave: true, minimumScore: 60 }, criteria[1]];
    const reviewed = person("reviewed", assessment(55, 100));
    reviewed.review = { scores: { core: 75, delivery: 100 }, decision: "advance", reason: "已核实补充材料。", conflictNote: "", confirmedAt: "2026-09-10T00:00:00.000Z" };
    expect(hardRequirementResult(reviewed, gated, "combined").state).toBe("met");
  });
  it("exports synthetic notice and evidence state", () => {
    const task = { id: "task", title: "测试岗位", jd: "测试 JD", synthetic: true, confirmed: true, criteria, candidates: [person("A", assessment(80, 20))], audit: [] } satisfies HiringTask;
    expect(comparisonReport(task, "combined").text).toContain("合成资料");
    expect(comparisonReport(task, "combined").text).toContain("证据不足");
  });
});
