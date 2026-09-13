import { z } from 'zod';
import { chunkDocument } from './chunking';
import { redactPersonalData } from './redaction';
import { criterionSchema, draftSchema, validateAssessment, validateCriteria, type Source } from './workflow';

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
  return chunkDocument([{ section: '已确认简历', text: resume }], 1000, 0)
    .map((chunk, i) => ({ id: `resume-${i + 1}`, kind: 'resume', locator: `简历片段 ${i + 1}`, text: chunk.text }));
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
