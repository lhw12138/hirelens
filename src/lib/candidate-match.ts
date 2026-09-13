import { z } from 'zod';
import { chunkDocument } from './chunking';
import { redactPersonalData } from './redaction';
import { criterionSchema, draftSchema, validateAssessment, validateCriteria, type Assessment, type Criterion, type Source } from './workflow';

export const matchInputSchema = z.object({
  requestId: z.uuid(),
  title: z.string().trim().min(2).max(100),
  jd: z.string().trim().min(50).max(15000),
  resume: z.string().trim().min(50).max(30000),
  consent: z.literal(true),
});
export const matchOutputSchema = z.object({
  criteria: z.array(criterionSchema).min(3).max(8),
  assessment: draftSchema,
  improvements: z.array(z.object({
    criterionId: z.string(),
    suggestion: z.string().min(10).max(800),
  })).min(1).max(8),
});
export type MatchReport = z.infer<typeof matchOutputSchema> & {
  sources: Source[]; overall: number | null; coverage: number;
  model: string; createdAt: string; policy: 'candidate-evidence-v1';
};
export type MatchRecord = { id: string; title: string; status: string; report: MatchReport | null; createdAt: string };

export function prepareMatchInput(input: unknown) {
  const parsed = matchInputSchema.parse(input);
  return { ...parsed, title: redactPersonalData(parsed.title).text, jd: redactPersonalData(parsed.jd).text, resume: redactPersonalData(parsed.resume).text };
}
export function resumeSources(resume: string): Source[] {
  return chunkDocument(resume.split(/\n{2,}/).map((text, i) => ({ section: `确认稿段落 ${i + 1}`, text })))
    .map((chunk, i) => ({ id: `resume-${i + 1}`, kind: 'resume', locator: `${chunk.section} · 字符 ${chunk.start + 1}–${chunk.end}`, text: chunk.text }));
}

export function candidateImprovements(criteria: Criterion[], assessment: Pick<Assessment, 'scores'>) {
  return criteria.map(criterion => {
    const score = assessment.scores.find(item => item.criterionId === criterion.id);
    const action = score?.status === 'conflict'
      ? '核对并统一时间、职责或成果描述，保留可核验的原始依据'
      : score?.status === 'supported'
        ? '保留现有直接证据，并补充你的具体行动、关键取舍和结果验证'
        : '补充与该要求直接相关的真实项目、个人行动和可核验结果；若暂无经历，请如实说明学习或实践计划';
    return { criterionId: criterion.id, suggestion: `${criterion.name}：${action}。` };
  });
}

export function buildCandidateMatchReport(criteria: Criterion[], assessment: Assessment, sources: Source[]) {
  return validateMatchReport({ criteria, assessment, improvements: candidateImprovements(criteria, assessment) }, sources, assessment.model);
}
export function validateMatchReport(value: unknown, sources: Source[], model: string): MatchReport {
  const result = matchOutputSchema.parse(value);
  validateCriteria(result.criteria);
  const assessment = validateAssessment(result.assessment, result.criteria, sources, 'screening');
  if (result.improvements.some(item => !result.criteria.some(c => c.id === item.criterionId))) throw new Error('改进建议引用了未知维度。');
  const coverage = result.criteria.reduce((sum, c) => sum + (assessment.scores.find(s => s.criterionId === c.id)?.score !== null ? c.weight : 0), 0);
  const overall = coverage < 100 ? null : Math.round(assessment.scores.reduce((sum, s) => sum + s.score! * result.criteria.find(c => c.id === s.criterionId)!.weight / 100, 0));
  return { ...result, assessment, sources, coverage, overall, model, createdAt: new Date().toISOString(), policy: 'candidate-evidence-v1' };
}
