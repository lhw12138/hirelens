import 'server-only';
import { getPool } from '@/server/db/client';
import type { HiringTask, Assessment } from '@/lib/workflow';
import { canPublish } from '@/lib/scoring-job';
import { assessPerson } from './model';
import { RagUnavailable } from './rag';
import { looksLikeTimeout, operationalRecovery, type OperationalErrorCode } from '@/lib/operational-errors';

// Persisted queue in the task aggregate. Claim and result publication are fenced
// by job identity and row version; page navigation has no part in execution.
export async function processScoringJob(assess:typeof assessPerson=assessPerson, onlyTaskId:string|null=null){
 const db=getPool();
 await db.query(`UPDATE hiring_tasks SET data=jsonb_set(jsonb_set(jsonb_set(data,'{scoringJob,status}','"failed"'),'{scoringJob,error}',to_jsonb($2::text)),'{scoringJob,errorCode}','"SCORING_TIMEOUT"'),version=version+1,updated_at=now() WHERE ($1::uuid IS NULL OR id=$1) AND data->'scoringJob'->>'status'='running' AND (data->'scoringJob'->>'startedAt')::timestamptz < now()-interval '10 minutes'`,[onlyTaskId,operationalRecovery.SCORING_TIMEOUT]);
 const claimed=await db.query(`UPDATE hiring_tasks SET data=jsonb_set(jsonb_set(data,'{scoringJob,status}','"running"'),'{scoringJob,startedAt}',to_jsonb(now()::text)),version=version+1,updated_at=now() WHERE id=(SELECT id FROM hiring_tasks WHERE ($1::uuid IS NULL OR id=$1) AND COALESCE(data->>'archivedAt',data->>'deletedAt') IS NULL AND data->'scoringJob'->>'status'='queued' ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1) RETURNING id,data,version`,[onlyTaskId]);
 const row=claimed.rows[0];if(!row)return false;
 const task=row.data as HiringTask;const job=task.scoringJob!;
 let result:Assessment|undefined;let error:string|undefined;let errorCode:OperationalErrorCode|undefined;
 try{const p=task.candidates.find(p=>p.id===job.candidateId);if(!p)throw Error('missing');result=await assess(task,p,job.action==='assess'||job.action==='reassess'?'combined':'screening');}
 catch(e){errorCode=e instanceof RagUnavailable?'RAG_UNAVAILABLE':looksLikeTimeout(e)?'MODEL_TIMEOUT':'MODEL_FAILED';error=operationalRecovery[errorCode];console.error(JSON.stringify({logType:'scoring_error',taskId:row.id,stage:job.action,durationMs:job.startedAt?Date.now()-Date.parse(job.startedAt):undefined,errorCode,at:new Date().toISOString()}));}
 const conn=await db.connect();
 try{
  await conn.query('BEGIN');
  const fresh=await conn.query('SELECT data,version FROM hiring_tasks WHERE id=$1 FOR UPDATE',[row.id]);
  const current=fresh.rows[0]?.data as HiringTask|undefined;
  if(current&&canPublish(current,job.id)){
   const person=current.candidates.find(p=>p.id===job.candidateId)!;
   if(result){if(job.action==='assess'||job.action==='reassess'){if(person.assessment)person.assessmentHistory=[...(person.assessmentHistory||[]),person.assessment];person.assessment=result;}else{if(person.screening)person.screeningHistory=[...(person.screeningHistory||[]),person.screening];person.screening=result;}}
   current.scoringJob={...current.scoringJob!,status:result?'succeeded':'failed',finishedAt:new Date().toISOString(),error,errorCode};
   current.audit.push({at:new Date().toISOString(),candidateId:job.candidateId,action:result?'后台评分完成，结果已保存':`后台评分未完成（${errorCode}），可重试`});
   await conn.query('UPDATE hiring_tasks SET data=$2::jsonb,version=version+1,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(current)]);
  }
  await conn.query('COMMIT');
 }catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}
 return true;
}
