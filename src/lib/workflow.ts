import type {ScoringJob} from './scoring-job';
import { z } from 'zod';
import type {RagTrace} from './hybrid-rag';
export const SCREENING_POLICY = 'resume-match-v2';
export const COMBINED_POLICY = 'combined-v4';

export const criterionSchema = z.object({ id: z.string().min(1), name: z.string().min(2).max(40), description: z.string().min(4).max(500), weight: z.number().int().min(1).max(100), mustHave: z.boolean().optional(), minimumScore: z.number().int().min(1).max(100).optional() });
export type Criterion = z.infer<typeof criterionSchema>;
export type Source = { id: string; kind: 'resume' | 'answer'; locator: string; text: string };
export const draftSchema = z.object({
  summary: z.string().min(10).max(2000),
  scores: z.array(z.object({ criterionId: z.string(), score: z.number().min(0).max(100).nullable(), claim: z.string().max(2000), sourceIds: z.array(z.string()), status: z.enum(['supported', 'low_match', 'partial_match', 'insufficient', 'conflict']) })),
  conflicts: z.array(z.object({ topic: z.string(), sourceIds: z.array(z.string()).min(2), description: z.string() })),
});
export type Assessment = z.infer<typeof draftSchema> & { model: string; latencyMs: number; inputTokens: number; outputTokens: number; createdAt: string; scoringVersion?: string; retrieval?:RagTrace };
export type Review = { scores: Record<string, number | null>; reason: string; conflictNote: string; decision: 'advance' | 'hold' | 'reject'; confirmedAt: string };
export type Person = {
  id: string; name: string; synthetic: boolean; filename: string; resume: string; resumeConfirmed: boolean;
  contactEmailsCiphertext?: string;
  sources: Source[]; questions: { id: string; criterionId: string; text: string }[];
  answers: Record<string, string>; interviewComplete: boolean; assessment?: Assessment; review?: Review;
  screening?: Assessment; screeningHistory?: Assessment[]; shortlisted?: boolean; interviewRecord?: string;
  assessmentHistory?: Assessment[];
  invitation?: { hash: string; expiresAt: string; sessionHash?: string };
};
export type HiringTask = { deletedAt?:string; archivedAt?:string; retentionDays?:30|90|null; purgeAfter?:string; demoDatasetKey?:string; scoringJob?:ScoringJob; id: string; title: string; jd: string; synthetic: boolean; confirmed: boolean; criteria: Criterion[]; evaluationCriteria?: Criterion[]; candidates: Person[]; audit: { at: string; action: string; candidateId?: string }[] };
export type TaskRecord = { id: string; version: number; updatedAt: string; data: HiringTask };
export const steps = ['确认岗位要求', '筛选简历', '安排面试与记录', '综合评估与审核'];
export function currentStep(task: HiringTask, person?: Person) {
  if (!task.confirmed) return 0;
  if (!person?.resumeConfirmed || !person.shortlisted) return 1;
  if (!person.interviewComplete) return 2;
  return 3;
}
export function screeningValue(person: Person, criteria: Criterion[]): number | null {
  if (!person.screening || person.screening.scores.some(s => s.score === null)) return null;
  return person.screening.scores.reduce((sum, s) => sum + (s.score ?? 0) * (criteria.find(c => c.id === s.criterionId)?.weight || 0) / 100, 0);
}
export function validateCriteria(criteria: Criterion[]) {
  z.array(criterionSchema).min(3).max(8).parse(criteria);
  if (new Set(criteria.map(c => c.id)).size !== criteria.length) throw new Error('评估维度不能重复。');
  if (criteria.reduce((sum, c) => sum + c.weight, 0) !== 100) throw new Error('权重合计需要为 100%，请调整后保存。');
  if (criteria.some(c => c.mustHave && (!c.minimumScore || c.minimumScore < 1 || c.minimumScore > 100))) throw new Error('硬性条件需要设置 1–100 分的最低参考线。');
}
export function validateAssessment(value: unknown, criteria: Criterion[], sources: Source[], phase: 'screening' | 'combined' = 'combined') {
  const draft = draftSchema.parse(value);
  if (draft.scores.length !== criteria.length || new Set(draft.scores.map(s => s.criterionId)).size !== criteria.length) throw new Error('模型遗漏了评估维度，请重试。');
  const ids = new Set(sources.map(s => s.id));
  for (const score of draft.scores) {
    if (!criteria.some(c => c.id === score.criterionId) || score.sourceIds.some(id => !ids.has(id))) throw new Error('模型引用了不属于本候选人的证据，请重试。');
    if (score.status === 'low_match' || score.status === 'partial_match') {
      if (phase !== 'screening') throw new Error('综合评估不能复用简历匹配评分。');
      if (score.score === null || !score.sourceIds.length || !score.claim.trim()) throw new Error('匹配评分须说明简历依据和岗位差距。');
      if ((score.status === 'low_match' && score.score > 24) || (score.status === 'partial_match' && (score.score < 25 || score.score > 69))) throw new Error('模型匹配等级与分数不一致，请重试。');
    }
    if (score.status === 'conflict') { score.score = null; continue; }
    if (phase === 'screening') {
      if (score.status === 'insufficient' || score.sourceIds.length === 0) { score.score = null; score.status = 'insufficient'; }
      else if (score.score === null || !score.claim.trim()) throw new Error('简历匹配评分须包含分数和判断依据。');
      continue;
    }
    if (score.status === 'insufficient') {
      if (score.score === null || score.score > 24) throw new Error('证据不足项需要给出 0–24 分的低置信度暂估匹配分。');
      continue;
    }
    if (score.score === null || !score.sourceIds.length || !score.claim.trim()) throw new Error('有依据的综合评分必须包含分数、引用和判断依据。');
  }
  for (const conflict of draft.conflicts) {
    if (new Set(conflict.sourceIds).size < 2 || conflict.sourceIds.some(id => !ids.has(id))) throw new Error('冲突缺少可核对的两条原文，请重试。');
  }
  return draft;
}
export function validateReview(person: Person, review: Omit<Review, 'confirmedAt'>) {
  if (!person.assessment) throw new Error('请先生成评估。');
  if (person.review) throw new Error('这份评估已确认。');
  const expected = person.assessment.scores;
  if (Object.keys(review.scores).length !== expected.length) throw new Error('请逐项审核所有维度。');
  for (const item of expected) {
    if (!(item.criterionId in review.scores)) throw new Error('审核维度不完整。');
    const score = review.scores[item.criterionId];
    if (score !== null && (!Number.isFinite(score) || score < 0 || score > 100)) throw new Error('评分须在 0–100 分之间。');
    if (item.score === null && score !== null && review.reason.trim().length < 8) throw new Error('补充评分需要说明核实依据。');
  }
  if (review.reason.trim().length < 4) throw new Error('请填写审核意见。');
  if ((person.assessment.conflicts.length || expected.some(s => s.status === 'conflict')) && review.conflictNote.trim().length < 8) throw new Error('请记录冲突的核实情况，也可以明确记录暂未核实。');
}
export function questionsFor(criteria: Criterion[]) {
  return criteria.map(c => ({ id: `q-${c.id}`, criterionId: c.id, text: `请结合一个具体项目说明你的「${c.name}」能力：${c.description} 请说清你的个人行动、关键取舍和验证结果。` }));
}
export const sampleJd = '招聘财务 AI 产品经理。负责核算、资金与经营分析场景的需求调研，编写 PRD 并确定优先级；设计基于知识检索的 AI 辅助方案，比较模型质量、响应时间与成本；协同财务、研发和 IT 推动上线，建立人工确认和风险处理机制。';
export const defaultCriteria: Criterion[] = [
  { id: 'experience', name: '相关工作经验', description: '核对与岗位职责相关的工作、项目和个人行动。', weight: 30 },
  { id: 'skills', name: '专业能力', description: '核对岗位要求的专业技能及实际运用证据。', weight: 30 },
  { id: 'problem', name: '问题分析与解决', description: '说明如何分析问题、作出取舍并验证结果。', weight: 25 },
  { id: 'collaboration', name: '沟通与协作', description: '核对需求沟通、团队协作与推进交付的具体经历。', weight: 15 },
];
export const sampleCriteria: Criterion[] = [
  { id: 'business', name: '业务理解', description: '理解财务流程，识别值得解决的问题。', weight: 25 },
  { id: 'product', name: '产品设计', description: '把需求转成可交付方案，解释优先级。', weight: 25 },
  { id: 'ai', name: 'AI 方案与评测', description: '说明检索、模型选型与质量验证的取舍。', weight: 25 },
  { id: 'delivery', name: '推进与协作', description: '推动跨部门交付，说明个人职责和项目时间。', weight: 25 },
];
export const sampleResume = '【合成简历，仅供体验】\n邮箱：candidate-a@example.com\n项目经历\n在财务共享平台项目中，梳理报销审批与对账流程，访谈财务、IT 和业务人员，整理人工核对环节的问题。\n产品设计\n编写需求文档和验收标准，先交付异常单据定位，再推进辅助解释；通过灰度上线和反馈收集调整优先级。\nAI 方案\n设计知识检索辅助方案，保留引用原文；比较关键词和语义检索，以引用准确性、无依据结论和耗时作为观察指标，审批由人工确认。\n项目交付\n简历记录项目实施期为 2022 年 3 月至 2023 年 6 月，负责跨团队需求评审与上线协调。';
export const sampleAnswers: Record<string, string> = {
  'q-business': '【合成回答】我先访谈财务和业务人员，把报销与对账流程拆成步骤，发现核对附件占用较多人工精力。因此先做辅助定位，保留人工审批。没有经过对照实验的数据，我不会声称效率提升。',
  'q-product': '【合成回答】我把需求写成用户故事和验收条件，按使用频率、风险和实现成本排序。先交付异常定位，再做辅助解释；上线后收集误报并修订规则。',
  'q-ai': '【合成回答】我会先比较无检索、关键词、语义召回三个基线，用固定测试问题检查引用是否真的支持结论。缺少证据就提示无法判断，并记录响应时间和用量，随后再考虑重排。',
  'q-delivery': '【合成回答】我的集中交付期是 2022 年 7 月至 2023 年 3 月，负责需求评审、风险升级和上线协调。这个时间与简历的整个实施周期不同，需要核实我实际参与的阶段。',
};
