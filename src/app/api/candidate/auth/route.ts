import { NextResponse } from 'next/server';
import { compare, hash } from 'bcryptjs';
import { createHash } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { createCandidateSession } from '@/lib/session';
import { allowAttempt } from '@/lib/attempt-limit';
import { candidateCredentials } from '@/lib/candidate-auth';
import { getDatabase } from '@/server/db/client';
import { candidateAccounts } from '@/server/db/schema';
import { WorkflowError } from '@/server/workflow/store';
import { candidateFailure, readCandidateJson } from '@/server/candidate/service';

export async function POST(request: Request) {
  try {
    const data = candidateCredentials.parse(await readCandidateJson(request));
    const emailKey = createHash('sha256').update(data.email).digest('hex');
    if (!allowAttempt('candidate-auth:global', 150) || !allowAttempt(`candidate-auth:${emailKey}`)) throw new WorkflowError('尝试次数较多，请15分钟后再试。', 429);
    if (Buffer.byteLength(data.password) > 72) throw new WorkflowError('密码最多72字节，请缩短后重试。');
    const db = getDatabase();
    let account: { id: string } | undefined;
    if (data.action === 'register') {
      [account] = await db.insert(candidateAccounts).values({ email: data.email, passwordHash: await hash(data.password, 12) }).onConflictDoNothing().returning({ id: candidateAccounts.id });
      if (!account) throw new WorkflowError('无法创建账号；若已注册，请使用登录。', 409);
    } else {
      const [found] = await db.select().from(candidateAccounts).where(eq(candidateAccounts.email, data.email));
      const valid = await compare(data.password, found?.passwordHash ?? '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW');
      if (!found || !valid) throw new WorkflowError('邮箱或密码不正确。', 401);
      account = found;
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set('merittrace_candidate', await createCandidateSession(account.id), { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 8 * 3600 });
    return response;
  } catch (error) { return candidateFailure(error); }
}
export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.delete('merittrace_candidate');
  return response;
}
