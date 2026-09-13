import { NextResponse } from 'next/server';
import { and, desc, eq, ne, sql } from 'drizzle-orm';
import { prepareMatchInput } from '@/lib/candidate-match';
import { candidateMatches } from '@/server/db/schema';
import { getDatabase } from '@/server/db/client';
import { WorkflowError } from '@/server/workflow/store';
import { candidateFailure, generateCandidateMatch, readCandidateJson, requireCandidate } from '@/server/candidate/service';

export const maxDuration = 180;
export async function GET() {
  try {
    const owner = await requireCandidate();
    const db = getDatabase();
    await db.update(candidateMatches).set({ status: 'failed' }).where(and(eq(candidateMatches.ownerId, owner), eq(candidateMatches.status, 'running'), sql`${candidateMatches.createdAt} < now() - interval '5 minutes'`));
    const records = await db.select().from(candidateMatches).where(and(eq(candidateMatches.ownerId, owner), ne(candidateMatches.status, 'deleted'))).orderBy(desc(candidateMatches.createdAt)).limit(30);
    return NextResponse.json({ records: records.map(row => ({ id: row.id, title: row.title, status: row.status, report: row.report, createdAt: row.createdAt })) }, { headers: { 'cache-control': 'no-store' } });
  } catch (error) { return candidateFailure(error); }
}
export async function POST(request: Request) {
  try {
    const owner = await requireCandidate();
    const input = prepareMatchInput(await readCandidateJson(request));
    const db = getDatabase();
    await db.transaction(async tx => {
      await tx.execute(sql`select pg_advisory_xact_lock(72134002)`);
      const [existing] = await tx.select({ id: candidateMatches.id }).from(candidateMatches).where(eq(candidateMatches.id, input.requestId));
      if (existing) throw new WorkflowError('此请求已经提交，请查看历史报告。', 409);
      const [usage] = await tx.select({ total: sql<number>`count(*)::int`, mine: sql<number>`count(*) filter (where ${candidateMatches.ownerId} = ${owner})::int`, running: sql<number>`count(*) filter (where ${candidateMatches.ownerId} = ${owner} and ${candidateMatches.status} = 'running' and ${candidateMatches.createdAt} > now() - interval '5 minutes')::int` }).from(candidateMatches).where(sql`${candidateMatches.createdAt} >= date_trunc('day', now() at time zone 'UTC') at time zone 'UTC'`);
      if (usage.running) throw new WorkflowError('已有分析在进行，请等待完成或五分钟后再试。', 409);
      if (usage.mine >= 5 || usage.total >= 100) throw new WorkflowError('今日试用分析额度已用完，请明天再试（UTC零点重置）。', 429);
      await tx.insert(candidateMatches).values({ id: input.requestId, ownerId: owner, title: input.title });
    });
    try {
      const report = await generateCandidateMatch(input.jd, input.resume);
      const [row] = await db.update(candidateMatches).set({ report, status: 'complete' }).where(and(eq(candidateMatches.id, input.requestId), eq(candidateMatches.ownerId, owner), eq(candidateMatches.status, 'running'))).returning();
      if (!row) throw new WorkflowError('报告已删除或已过期，不再保存分析内容。', 409);
      return NextResponse.json({ record: { id: row.id, title: row.title, status: row.status, report: row.report, createdAt: row.createdAt } });
    } catch (error) {
      await db.update(candidateMatches).set({ status: 'failed' }).where(and(eq(candidateMatches.id, input.requestId), eq(candidateMatches.ownerId, owner), eq(candidateMatches.status, 'running')));
      return candidateFailure(error);
    }
  } catch (error) { return candidateFailure(error); }
}
export async function DELETE(request: Request) {
  try {
    const owner = await requireCandidate();
    const { id } = await readCandidateJson(request);
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) throw new WorkflowError('报告编号不正确。');
    const [row] = await getDatabase().update(candidateMatches).set({ status: 'deleted', title: '', report: null }).where(and(eq(candidateMatches.id, id), eq(candidateMatches.ownerId, owner))).returning({ id: candidateMatches.id });
    if (!row) throw new WorkflowError('找不到这份报告。', 404);
    return NextResponse.json({ ok: true });
  } catch (error) { return candidateFailure(error); }
}
