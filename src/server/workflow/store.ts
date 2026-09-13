import 'server-only';
import { and, desc, eq, sql } from 'drizzle-orm';
import { cookies } from 'next/headers';
import { verifyHrSession } from '@/lib/session';
import { getDatabase } from '@/server/db/client';
import { hiringTasks } from '@/server/db/schema';
import type { HiringTask } from '@/lib/workflow';
import type { OperationalErrorCode } from '@/lib/operational-errors';
export class WorkflowError extends Error {
  constructor(message: string, public status = 400, public code?: OperationalErrorCode) { super(message); }
}
export async function requireOwner() {
  const cookie = (await cookies()).get('hirelens_session')?.value;
  const account = cookie ? await verifyHrSession(cookie).catch(() => null) : null;
  if (!account) throw new WorkflowError('登录已过期，请重新登录。', 401);
  return account.email;
}
export async function listTasks(owner: string, deleted=false) {
  return getDatabase().select().from(hiringTasks).where(and(eq(hiringTasks.ownerEmail, owner), deleted ? sql`COALESCE(${hiringTasks.data}->>'archivedAt',${hiringTasks.data}->>'deletedAt') IS NOT NULL` : sql`COALESCE(${hiringTasks.data}->>'archivedAt',${hiringTasks.data}->>'deletedAt') IS NULL`)).orderBy(desc(hiringTasks.updatedAt));
}
export async function loadTask(id: string, owner?: string, includeDeleted=false) {
  const [row] = await getDatabase().select().from(hiringTasks).where(owner ? and(eq(hiringTasks.id, id), eq(hiringTasks.ownerEmail, owner)) : eq(hiringTasks.id, id));
  if (!row || (!includeDeleted && (row.data.archivedAt || row.data.deletedAt))) throw new WorkflowError('找不到这项招聘任务，请返回首页。', 404);
  return row;
}
export async function saveTask(data: HiringTask, version: number, owner: string, action: string, candidateId?: string) {
  data.audit.push({ at: new Date().toISOString(), action, candidateId });
  const [row] = await getDatabase().update(hiringTasks).set({ data, version: version + 1, updatedAt: new Date() })
    .where(and(eq(hiringTasks.id, data.id), eq(hiringTasks.ownerEmail, owner), eq(hiringTasks.version, version), sql`COALESCE(${hiringTasks.data}->>'archivedAt',${hiringTasks.data}->>'deletedAt') IS NULL`, sql`COALESCE(${hiringTasks.data}->'scoringJob'->>'status','') NOT IN ('queued','running')`)).returning();
  if (!row) throw new WorkflowError('这项任务刚刚有更新。请刷新后继续，已保存的数据不会丢失。', 409);
  return row;
}
export async function findInvitation(hash: string) {
  const [row] = await getDatabase().select().from(hiringTasks)
    .where(sql`COALESCE(${hiringTasks.data}->>'archivedAt',${hiringTasks.data}->>'deletedAt') IS NULL AND ${hiringTasks.data}->'candidates' @> ${JSON.stringify([{ invitation: { hash } }])}::jsonb`);
  if (!row) throw new WorkflowError('面试链接无效。请联系招聘负责人重新发送。', 404);
  const invitation = row.data.candidates.find(person => person.invitation?.hash === hash)?.invitation;
  if (!invitation || Date.parse(invitation.expiresAt) <= Date.now()) throw new WorkflowError('面试链接已过期。请联系招聘负责人重新发送。', 410);
  return row;
}
