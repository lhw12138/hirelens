import 'server-only';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { verifyCandidateSession } from '@/lib/session';
import { buildCandidateMatchReport, resumeSources } from '@/lib/candidate-match';
import { redactPersonalData, assertSafeForTracing } from '@/lib/redaction';
import { questionsFor, type HiringTask, type Person } from '@/lib/workflow';
import { candidateAccounts } from '@/server/db/schema';
import { getDatabase } from '@/server/db/client';
import { assessPerson, parseJob } from '@/server/workflow/model';
import { WorkflowError } from '@/server/workflow/store';

export async function requireCandidate() {
  const token = (await cookies()).get('merittrace_candidate')?.value;
  const id = token ? await verifyCandidateSession(token).catch(() => null) : null;
  if (!id) throw new WorkflowError('请重新登录候选人账号。', 401);
  const [account] = await getDatabase().select({ id: candidateAccounts.id }).from(candidateAccounts).where(eq(candidateAccounts.id, id));
  if (!account) throw new WorkflowError('账号已失效，请重新登录。', 401);
  return id;
}
export function candidateFailure(error: unknown) {
  if (error instanceof WorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError) return NextResponse.json({ error: '请检查输入长度、邮箱格式和确认选项。' }, { status: 400 });
  const incident = crypto.randomUUID();
  const detail = error instanceof Error
    ? redactPersonalData(`${error.name}: ${error.message}`)
      .text
      .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
      .replace(/\bsk-[A-Za-z0-9_-]{8,}\b/gi, '[redacted-api-key]')
      .replace(/\s+/g, ' ')
      .slice(0, 500)
    : 'Unknown non-Error failure';
  console.error('candidate_request_failed', incident, detail);
  return NextResponse.json({ error: '处理未完成，请稍后重试。若持续失败，请联系管理员。', incident }, { status: 503 });
}
export async function readCandidateJson(request: Request) {
  const text = await request.text();
  if (text.length > 60_000) throw new WorkflowError('输入内容过长，请缩短后重试。', 413);
  try { return JSON.parse(text); } catch { throw new WorkflowError('请求格式不正确。', 400); }
}
export async function generateCandidateMatch(jd: string, resume: string) {
  const safeJd = redactPersonalData(jd).text;
  const safeResume = redactPersonalData(resume).text;
  const sources = resumeSources(safeResume);
  const outbound = { jd: safeJd, sources };
  assertSafeForTracing(outbound);
  const criteria = await parseJob(safeJd);
  const person: Person = { id: crypto.randomUUID(), name: '候选人', synthetic: false, filename: '候选人确认稿', resume: safeResume, resumeConfirmed: true, sources, questions: questionsFor(criteria), answers: {}, interviewComplete: false };
  const task: HiringTask = { id: crypto.randomUUID(), title: '候选人岗位匹配自测', jd: safeJd, synthetic: false, confirmed: true, criteria, candidates: [person], audit: [] };
  const assessment = await assessPerson(task, person, 'screening', 'candidate').catch(error => {
    if (!(error instanceof z.ZodError)) throw error;
    const issues = error.issues.slice(0, 5).map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`).join('; ');
    throw new Error(`共享匹配引擎输出未通过校验：${issues}`);
  });
  return buildCandidateMatchReport(criteria, assessment, sources);
}
