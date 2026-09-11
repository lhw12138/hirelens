import { assessmentFor, hardRequirementResult, rankCandidates, type ComparisonStage, type HardRequirementState } from "@/lib/candidate-comparison";
import { isEligibleScoringEvidence } from "@/lib/evidence-policy";
import type { HiringTask } from "@/lib/workflow";

type EvidenceStatus = "supported" | "low_match" | "partial_match" | "insufficient" | "conflict";
type StageBenchmark = {
  tiers: string[][];
  hardRequirements: Record<string, HardRequirementState>;
  minimumStatusCounts?: Partial<Record<EvidenceStatus, number>>;
};
export type RecruitmentBenchmark = {
  version: string;
  absoluteScoreGates: false;
  tasks: Array<{ datasetKey: string; title: string; stages: Record<ComparisonStage, StageBenchmark> }>;
};
export type BenchmarkTaskResult = { datasetKey: string; title: string; passed: boolean; checks: string[]; failures: string[] };

const email = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const phone = /(?<!\d)1[3-9]\d{9}(?!\d)/u;
const idCard = /(?<!\d)\d{6}(?:19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[0-9Xx](?!\d)/u;

function pushCheck(condition: boolean, message: string, checks: string[], failures: string[]) {
  (condition ? checks : failures).push(message);
}

export function evaluateRecruitmentBenchmark(tasks: HiringTask[], benchmark: RecruitmentBenchmark) {
  const results: BenchmarkTaskResult[] = benchmark.tasks.map((expected) => {
    const checks: string[] = [];
    const failures: string[] = [];
    const task = tasks.find((item) => item.demoDatasetKey === expected.datasetKey);
    if (!task) return { datasetKey: expected.datasetKey, title: expected.title, passed: false, checks, failures: ["缺少对应的合成任务"] };
    pushCheck(task.synthetic === true, "任务明确标记为合成数据", checks, failures);
    pushCheck(task.criteria.length >= 3 && task.criteria.length <= 8, "岗位维度由任务自身定义且数量有效", checks, failures);

    for (const stage of ["screening", "combined"] as const) {
      const expectedStage = expected.stages[stage];
      const criteria = stage === "screening" ? task.criteria : task.evaluationCriteria || task.criteria;
      const ranked = rankCandidates(task.candidates, criteria, stage);
      const position = new Map(ranked.map((person, index) => [person.name, index]));
      const expectedNames = expectedStage.tiers.flat();
      pushCheck(expectedNames.every((name) => position.has(name)), `${stage}：基准候选人完整`, checks, failures);
      for (let index = 0; index < expectedStage.tiers.length - 1; index += 1) {
        const earlier = expectedStage.tiers[index].map((name) => position.get(name) ?? Number.POSITIVE_INFINITY);
        const later = expectedStage.tiers[index + 1].map((name) => position.get(name) ?? -1);
        pushCheck(Math.max(...earlier) < Math.min(...later), `${stage}：第 ${index + 1} 档整体排在第 ${index + 2} 档之前`, checks, failures);
      }
      for (const [name, state] of Object.entries(expectedStage.hardRequirements)) {
        const person = task.candidates.find((item) => item.name === name);
        pushCheck(Boolean(person) && hardRequirementResult(person!, criteria, stage).state === state, `${stage}：${name} 的硬性条件状态为 ${state}`, checks, failures);
      }
      for (const [status, minimum] of Object.entries(expectedStage.minimumStatusCounts || {}) as Array<[EvidenceStatus, number]>) {
        const count = task.candidates.flatMap((person) => assessmentFor(person, stage)?.scores || []).filter((item) => item.status === status).length;
        pushCheck(count >= minimum, `${stage}：至少保留 ${minimum} 个 ${status} 证据场景`, checks, failures);
      }
    }

    for (const person of task.candidates) {
      const material = [person.resume, person.interviewRecord || "", ...person.sources.map((source) => source.text)].join("\n");
      pushCheck(!email.test(material) && !phone.test(material) && !idCard.test(material), `${person.name}：评分材料不含未脱敏邮箱、手机号或证件号`, checks, failures);
      const referenced = new Set([person.screening, person.assessment].flatMap((assessment) => assessment?.scores.flatMap((score) => score.sourceIds) || []));
      const unsafeReference = person.sources.some((source) => referenced.has(source.id) && !isEligibleScoringEvidence(source.text));
      pushCheck(!unsafeReference, `${person.name}：身份信息片段未作为评分证据`, checks, failures);
    }
    return { datasetKey: expected.datasetKey, title: task.title, passed: failures.length === 0, checks, failures };
  });
  return { version: benchmark.version, absoluteScoreGates: benchmark.absoluteScoreGates, passed: results.every((item) => item.passed), results };
}
