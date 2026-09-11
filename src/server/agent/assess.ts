import "server-only";
import { generateText, isStepCount } from "ai";
import { assessmentDraftSchema } from "@/lib/schemas";
import { candidates } from "@/lib/demo-data";
import { getLanguageModel, modelConfig } from "@/server/ai/provider";
import { assessmentTools } from "./tools";

const promptVersion = "assessment-v1.0.0";

export async function createAssessmentDraft(candidateId: string) {
  const candidate = candidates.find((item) => item.id === candidateId) ?? candidates[0];
  const model = getLanguageModel("review");
  if (!model) {
    return {
      mode: "synthetic-demo" as const,
      promptVersion,
      modelId: "deterministic-demo",
      output: assessmentDraftSchema.parse({
        summary: `${candidate.name}具备产品落地证据，但财务系统深度仍需 HR 结合面试原文核实。`,
        recommendation: candidate.scores.some((score) => score.status === "conflict") ? "hold" : "advance",
        scores: candidate.scores.map((score) => ({ competencyId: score.competencyId, score: score.aiScore, claim: score.claim, citationIds: candidate.citations.filter((citation) => citation.competencyId === score.competencyId).map((citation) => citation.id), evidenceStatus: score.status === "grounded" ? "supported" : score.status === "conflict" ? "conflict" : "insufficient" })),
        conflicts: candidate.citations.filter((citation) => citation.status === "conflict").map((item) => ({ topic: item.competencyId, resumeClaim: "简历与回答中的信息不一致", interviewClaim: item.quote })),
        questionsForHr: ["是否接受候选人补充可核验的财务系统交付证据？"],
      }),
    };
  }

  const started = Date.now();
  const result = await generateText({
    model,
    instructions: "你是受控招聘决策辅助 Agent。评分必须引用工具返回的证据。证据不足就明确返回 insufficient；发现冲突只标记待 HR 核实。你无权改变候选人最终状态。完成检索和计算后，必须调用 draft_assessment 提交完整草稿。",
    prompt: `为 job-fin-ai-pm 的候选人 ${candidate.id} 生成评估草稿。先读取岗位模型，再为每项胜任力检索简历和面试证据、检查冲突、计算规则分，最后调用 draft_assessment。不要使用工具未返回的引用 ID。`,
    tools: assessmentTools,
    stopWhen: isStepCount(6),
    timeout: { totalMs: 120_000, stepMs: 30_000 },
    maxRetries: 2,
  });

  const draftResult = result.steps
    .flatMap((step) => step.toolResults)
    .find((toolResult) => toolResult.toolName === "draft_assessment");
  const output = assessmentDraftSchema.parse(
    (draftResult?.output as { assessment?: unknown } | undefined)?.assessment,
  );

  return { mode: "model" as const, promptVersion, modelId: modelConfig("review").id, latencyMs: Date.now() - started, output };
}
