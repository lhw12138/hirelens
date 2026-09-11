import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getDatabase } from '@/server/db/client';
import { hiringTasks } from '@/server/db/schema';
import { listTasks, requireOwner, WorkflowError } from '@/server/workflow/store';
import { sampleJd, sampleCriteria, type HiringTask } from '@/lib/workflow';
import {RagUnavailable} from '@/server/workflow/rag';
import {publicTaskRecord} from '@/server/workflow/candidate-contact';
import { looksLikeDatabaseError, operationalRecovery, type OperationalErrorCode } from '@/lib/operational-errors';
export async function GET(request:Request) {
  try { const url=new URL(request.url);return NextResponse.json((await listTasks(await requireOwner(),url.searchParams.get('archived')==='true'||url.searchParams.get('deleted')==='true')).map(publicTaskRecord)); }
  catch (e) { return failure(e); }
}
export async function POST(request: Request) {
  try {
    const ownerEmail = await requireOwner();
    const { synthetic } = z.object({ synthetic: z.boolean() }).parse(await request.json());
    const id = crypto.randomUUID();
    const data: HiringTask = { id, title: synthetic ? '财务 AI 产品经理 · 示例' : '', jd: synthetic ? sampleJd : '', criteria: synthetic ? sampleCriteria : [], synthetic, confirmed: false, candidates: [], audit: [{ at: new Date().toISOString(), action: synthetic ? '创建合成体验任务' : '创建招聘任务，等待输入 JD' }] };
    const [row] = await getDatabase().insert(hiringTasks).values({ id, ownerEmail, data }).returning();
    return NextResponse.json(row, { status: 201 });
  } catch (e) { return failure(e); }
}
export function failure(e: unknown) {
  let status=503;let code:OperationalErrorCode="INTERNAL_UNAVAILABLE";let message=operationalRecovery.INTERNAL_UNAVAILABLE;
  if(e instanceof RagUnavailable){code="RAG_UNAVAILABLE";message=operationalRecovery[code];}
  else if(e instanceof WorkflowError){status=e.status;code=e.code||(e.status===401?"AUTH_REQUIRED":e.status===409?"CONFLICT":"INVALID_INPUT");message=e.message;}
  else if(e instanceof z.ZodError){status=400;code="INVALID_INPUT";message='填写的信息不完整或格式不正确，请检查后重试。';}
  else if(looksLikeDatabaseError(e)){code="DATABASE_UNAVAILABLE";message=operationalRecovery[code];}
  const incidentId=status>=500?crypto.randomUUID():undefined;
  if(incidentId)console.error(JSON.stringify({logType:"operational_error",incidentId,code,status,at:new Date().toISOString()}));
  return NextResponse.json({error:message,code,incidentId},{status});
}
