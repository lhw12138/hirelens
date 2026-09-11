import { describe, expect, it } from "vitest";
import benchmarkJson from "../../data/recruitment-benchmark-v1.json";
import { evaluateRecruitmentBenchmark, type RecruitmentBenchmark } from "./recruitment-benchmark";
import type { Assessment, HiringTask, Person } from "./workflow";

const assessment = (score: number): Assessment => ({ summary: "合成评估摘要足够长。", scores: ["skill", "delivery", "collaboration"].map((criterionId) => ({ criterionId, score, claim: "工作行动证据", sourceIds: ["source-1"], status: "supported" as const })), conflicts: [], model: "test", latencyMs: 1, inputTokens: 1, outputTokens: 1, createdAt: "2026-09-10T00:00:00.000Z" });
const person = (name: string, score: number): Person => ({ id: name, name, synthetic: true, filename: "synthetic.pdf", resume: "负责系统设计与交付，联系方式均已脱敏。", resumeConfirmed: true, sources: [{ id: "source-1", kind: "resume", locator: "段落 1", text: "负责系统设计、验证与交付。" }], questions: [], answers: {}, interviewComplete: true, screening: assessment(score), assessment: assessment(score) });

describe("recruitment benchmark", () => {
  it("declares that synthetic data never controls absolute candidate scores", () => expect((benchmarkJson as unknown as RecruitmentBenchmark).absoluteScoreGates).toBe(false));
  it("checks tier ordering without requiring exact scores", () => {
    const fixture: RecruitmentBenchmark = { version: "test", absoluteScoreGates: false, tasks: [{ datasetKey: "generic", title: "任意岗位", stages: { screening: { tiers: [["强"], ["中"], ["弱"]], hardRequirements: {} }, combined: { tiers: [["强"], ["中"], ["弱"]], hardRequirements: {} } } }] };
    const task: HiringTask = { id: "task", demoDatasetKey: "generic", title: "任意岗位", jd: "任意合法岗位 JD", synthetic: true, confirmed: true, criteria: [{ id: "skill", name: "岗位核心能力", description: "根据当前岗位动态定义", weight: 40 }, { id: "delivery", name: "交付能力", description: "根据当前岗位动态定义", weight: 30 }, { id: "collaboration", name: "协作能力", description: "根据当前岗位动态定义", weight: 30 }], candidates: [person("弱", 5), person("强", 91), person("中", 52)], audit: [] };
    expect(evaluateRecruitmentBenchmark([task], fixture).passed).toBe(true);
    task.candidates.find((item) => item.name === "弱")!.assessment = assessment(99);
    expect(evaluateRecruitmentBenchmark([task], fixture).passed).toBe(false);
  });
});
