import type { Assessment, Criterion, HiringTask, Person } from "@/lib/workflow";

export type ComparisonStage = "screening" | "combined";
export type HardRequirementState = "met" | "verify" | "unmet" | "none";

export function assessmentFor(person: Person, stage: ComparisonStage): Assessment | undefined {
  return stage === "screening" ? person.screening : person.assessment;
}

export function comparisonScores(person: Person, stage: ComparisonStage) {
  const assessment = assessmentFor(person, stage);
  if (!assessment) return {} as Record<string, number | null>;
  if (stage === "combined" && person.review) return person.review.scores;
  return Object.fromEntries(assessment.scores.map((item) => [item.criterionId, item.score]));
}

export function comparisonTotal(person: Person, criteria: Criterion[], stage: ComparisonStage): number | null {
  const scores = comparisonScores(person, stage);
  if (!criteria.length || criteria.some((item) => typeof scores[item.id] !== "number")) return null;
  const weight = criteria.reduce((sum, item) => sum + item.weight, 0);
  if (!weight) return null;
  return criteria.reduce((sum, item) => sum + (scores[item.id] as number) * item.weight / weight, 0);
}

export function hardRequirementResult(person: Person, criteria: Criterion[], stage: ComparisonStage) {
  const assessment = assessmentFor(person, stage);
  const reviewedScores = stage === "combined" ? person.review?.scores : undefined;
  const required = criteria.filter((item) => item.mustHave);
  if (!required.length) return { state: "none" as HardRequirementState, failed: [], verify: [] };
  const failed: Criterion[] = [];
  const verify: Criterion[] = [];
  for (const criterion of required) {
    const item = assessment?.scores.find((score) => score.criterionId === criterion.id);
    const reviewedScore = reviewedScores?.[criterion.id];
    if (reviewedScores) {
      if (typeof reviewedScore !== "number") verify.push(criterion);
      else if (reviewedScore < (criterion.minimumScore || 60)) failed.push(criterion);
    } else if (!item || item.status === "conflict" || item.status === "insufficient" || item.score === null) verify.push(criterion);
    else if (item.score < (criterion.minimumScore || 60)) failed.push(criterion);
  }
  return { state: failed.length ? "unmet" as const : verify.length ? "verify" as const : "met" as const, failed, verify };
}

export function rankCandidates(people: Person[], criteria: Criterion[], stage: ComparisonStage) {
  return [...people].sort((a, b) => {
    const order: Record<HardRequirementState, number> = { met: 0, none: 0, verify: 1, unmet: 2 };
    const aGate = hardRequirementResult(a, criteria, stage);
    const bGate = hardRequirementResult(b, criteria, stage);
    if (order[aGate.state] !== order[bGate.state]) return order[aGate.state] - order[bGate.state];
    const aTotal = comparisonTotal(a, criteria, stage);
    const bTotal = comparisonTotal(b, criteria, stage);
    if (aTotal === null && bTotal === null) return a.name.localeCompare(b.name, "zh-CN");
    if (aTotal === null) return 1;
    if (bTotal === null) return -1;
    return bTotal - aTotal;
  });
}

export const evidenceStatusLabel = {
  supported: "直接证据",
  partial_match: "部分 / 可迁移",
  low_match: "低匹配",
  insufficient: "证据不足",
  conflict: "信息冲突",
} as const;
export const hardRequirementLabel: Record<HardRequirementState, string> = { met: "硬性条件已满足", verify: "硬性条件待核实", unmet: "硬性条件未满足", none: "未设置硬性条件" };

const decisionLabel = { advance: "进入下一轮", hold: "补充信息后再判断", reject: "不推进" } as const;
const cleanName = (value: string) => value.replace(/[\\/:*?"<>|]/g, "-").slice(0, 60) || "招聘任务";

export function comparisonReport(task: HiringTask, stage: ComparisonStage) {
  const criteria = stage === "screening" ? task.criteria : task.evaluationCriteria || task.criteria;
  const people = rankCandidates(task.candidates.filter((person) => assessmentFor(person, stage)), criteria, stage);
  const lines = [
    `# ${task.title}｜${stage === "screening" ? "简历初筛" : "综合评估"}对比报告`,
    "",
    task.synthetic ? "> 本报告使用合成资料，仅用于产品演示和系统评测。" : "",
    "> 分数用于辅助阅读和核对证据，不构成自动录用或淘汰决定。",
    "",
    `生成时间：${new Date().toLocaleString("zh-CN")}`,
    `候选人数：${people.length}`,
    "",
    "## 排名概览",
    "",
    "| 排名 | 候选人 | 加权总分 | 硬性条件 | 证据状态 | 人工决定 |",
    "| --- | --- | ---: | --- | --- | --- |",
    ...people.map((person, index) => {
      const assessment = assessmentFor(person, stage)!;
      const total = comparisonTotal(person, criteria, stage);
      const warnings = assessment.scores.filter((score) => score.status === "insufficient" || score.status === "conflict").map((score) => evidenceStatusLabel[score.status]);
      return `| ${total === null ? "—" : index + 1} | ${person.name} | ${total === null ? "待核实" : total.toFixed(1)} | ${hardRequirementLabel[hardRequirementResult(person, criteria, stage).state]} | ${warnings.length ? [...new Set(warnings)].join("、") : "证据完整"} | ${person.review ? decisionLabel[person.review.decision] : "待人工确认"} |`;
    }),
  ];
  for (const person of people) {
    const assessment = assessmentFor(person, stage)!;
    const scores = comparisonScores(person, stage);
    lines.push("", `## ${person.name}`, "", `加权总分：${comparisonTotal(person, criteria, stage)?.toFixed(1) ?? "待核实"}`, `状态：${person.review && stage === "combined" ? "人工已确认" : "AI 草稿，待人工核对"}`, "", assessment.summary);
    for (const criterion of criteria) {
      const item = assessment.scores.find((score) => score.criterionId === criterion.id);
      lines.push("", `### ${criterion.name}（权重 ${criterion.weight}%）`, "", `分数：${scores[criterion.id] ?? "待核实"}`, `证据状态：${item ? evidenceStatusLabel[item.status] : "未生成"}`, item?.claim || "暂无判断。");
      for (const sourceId of item?.sourceIds || []) {
        const source = person.sources.find((candidateSource) => candidateSource.id === sourceId);
        if (source) lines.push("", `> ${source.kind === "resume" ? "简历" : "面试记录"} · ${source.locator}`, `> ${source.text.replace(/\n/g, " ")}`);
      }
    }
    if (assessment.conflicts.length) lines.push("", "冲突提醒：", ...assessment.conflicts.map((item) => `- ${item.topic}：${item.description}`));
    if (person.review && stage === "combined") lines.push("", `人工决定：${decisionLabel[person.review.decision]}`, `审核意见：${person.review.reason}`);
    lines.push("", `生成信息：${assessment.model} · ${assessment.scoringVersion || "未记录规则版本"} · ${assessment.createdAt}`);
  }
  return { text: lines.filter((line, index) => line || lines[index - 1] !== "").join("\n"), filename: `MeritTrace-候选人对比-${cleanName(task.title)}.md` };
}
