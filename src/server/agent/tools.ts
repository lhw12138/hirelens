import { tool } from "ai";
import { z } from "zod";
import { activeJob, candidates } from "@/lib/demo-data";
import { calculateWeightedScore } from "@/lib/scoring";
import { assessmentDraftSchema } from "@/lib/schemas";

export const assessmentTools = {
  read_job_model: tool({
    description: "读取当前岗位已经由 HR 确认的胜任力模型。",
    inputSchema: z.object({ jobId: z.string() }),
    execute: async () => ({ job: activeJob.title, competencies: activeJob.competencies }),
  }),
  retrieve_resume_evidence: tool({
    description: "只检索当前候选人的简历证据片段。",
    inputSchema: z.object({ candidateId: z.string(), competencyId: z.string() }),
    execute: async ({ candidateId, competencyId }) => candidates.find((item) => item.id === candidateId)?.citations.filter((item) => item.competencyId === competencyId) ?? [],
  }),
  retrieve_interview_evidence: tool({
    description: "只检索当前候选人的结构化面试证据。",
    inputSchema: z.object({ candidateId: z.string(), competencyId: z.string() }),
    execute: async ({ candidateId, competencyId }) => candidates.find((item) => item.id === candidateId)?.citations.filter((item) => item.competencyId === competencyId && item.sourceType === "interview") ?? [],
  }),
  detect_conflicts: tool({
    description: "检查简历与面试证据是否冲突；只标记，不判断真假。",
    inputSchema: z.object({ candidateId: z.string() }),
    execute: async ({ candidateId }) => ({ conflicts: candidates.find((item) => item.id === candidateId)?.citations.filter((item) => item.status === "conflict") ?? [] }),
  }),
  calculate_rule_score: tool({
    description: "按 HR 已确认权重计算规则分。",
    inputSchema: z.object({ scores: z.record(z.string(), z.number().min(0).max(10)) }),
    execute: async ({ scores }) => ({ score: calculateWeightedScore(activeJob.competencies, activeJob.competencies.map((competency) => ({ competencyId: competency.id, aiScore: scores[competency.id] ?? 0, hrAdjustment: 0, evidenceCount: 0, status: "review" as const, claim: "规则计算输入" }))) }),
  }),
  draft_assessment: tool({
    description: "提交完整的待 HR 确认评估草稿。每项分数必须带证据引用；不得修改最终招聘状态。",
    inputSchema: assessmentDraftSchema,
    execute: async (assessment) => ({
      status: "draft_requires_human_confirmation" as const,
      assessment,
    }),
  }),
};

export const ASSESSMENT_TOOL_ALLOWLIST = Object.freeze(Object.keys(assessmentTools));
