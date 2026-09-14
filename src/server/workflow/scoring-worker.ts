import 'server-only';
import { getPool } from '@/server/db/client';
import type { HiringTask, Assessment } from '@/lib/workflow';
import { canPublish, scoringJobs, updateScoringJob, type ScoringJob } from '@/lib/scoring-job';
import { assessPerson } from './model';
import { RagUnavailable } from './rag';
import { looksLikeTimeout, operationalRecovery, type OperationalErrorCode } from '@/lib/operational-errors';

const activeJobSql = `(data->'scoringJob'->>'status' = $2 OR EXISTS (
  SELECT 1 FROM jsonb_array_elements(CASE WHEN jsonb_typeof(data->'scoringJobs')='array' THEN data->'scoringJobs' ELSE '[]'::jsonb END) job
  WHERE job->>'status' = $2
))`;

async function expireStaleJob(onlyTaskId:string|null){
 const conn=await getPool().connect();
 try{
  await conn.query('BEGIN');
  const stale=await conn.query(`SELECT id,data FROM hiring_tasks WHERE ($1::uuid IS NULL OR id=$1) AND ${activeJobSql} ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1`,[onlyTaskId,'running']);
  const row=stale.rows[0];if(!row){await conn.query('ROLLBACK');return;}
  const task=row.data as HiringTask;const cutoff=Date.now()-10*60*1000;let changed=false;
  for(const job of scoringJobs(task))if(job.status==='running'&&job.startedAt&&Date.parse(job.startedAt)<cutoff){updateScoringJob(task,{...job,status:'failed',finishedAt:new Date().toISOString(),error:operationalRecovery.SCORING_TIMEOUT,errorCode:'SCORING_TIMEOUT'});changed=true;}
  if(changed)await conn.query('UPDATE hiring_tasks SET data=$2::jsonb,version=version+1,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(task)]);
  await conn.query('COMMIT');
 }catch(error){await conn.query('ROLLBACK');throw error;}finally{conn.release();}
}

async function claimScoringJob(onlyTaskId:string|null){
 const conn=await getPool().connect();
 try{
  await conn.query('BEGIN');
  const claimed=await conn.query(`SELECT id,data FROM hiring_tasks WHERE ($1::uuid IS NULL OR id=$1) AND COALESCE(data->>'archivedAt',data->>'deletedAt') IS NULL AND ${activeJobSql} ORDER BY updated_at FOR UPDATE SKIP LOCKED LIMIT 1`,[onlyTaskId,'queued']);
  const row=claimed.rows[0];if(!row){await conn.query('ROLLBACK');return undefined;}
  const task=row.data as HiringTask;const job=scoringJobs(task).filter(item=>item.status==='queued').sort((a,b)=>Date.parse(a.queuedAt)-Date.parse(b.queuedAt))[0];
  if(!job){await conn.query('ROLLBACK');return undefined;}
  const running:ScoringJob={...job,status:'running',startedAt:new Date().toISOString()};updateScoringJob(task,running);
  await conn.query('UPDATE hiring_tasks SET data=$2::jsonb,version=version+1,updated_at=now() WHERE id=$1',[row.id,JSON.stringify(task)]);
  await conn.query('COMMIT');return{id:row.id as string,task,job:running};
 }catch(error){await conn.query('ROLLBACK');throw error;}finally{conn.release();}
}

// Multiple candidates in one task may be queued together. Workers still claim
// one job at a time with row locks, while the UI remains usable for other people.
export async function processScoringJob(assess:typeof assessPerson=assessPerson,onlyTaskId:string|null=null){
 await expireStaleJob(onlyTaskId);
 const claimed=await claimScoringJob(onlyTaskId);if(!claimed)return false;
 const {id,task,job}=claimed;
 let result:Assessment|undefined;let error:string|undefined;let errorCode:OperationalErrorCode|undefined;
 try{const person=task.candidates.find(item=>item.id===job.candidateId);if(!person)throw Error('missing');result=await assess(task,person,job.action==='assess'||job.action==='reassess'?'combined':'screening');}
 catch(cause){errorCode=cause instanceof RagUnavailable?'RAG_UNAVAILABLE':looksLikeTimeout(cause)?'MODEL_TIMEOUT':'MODEL_FAILED';error=operationalRecovery[errorCode];console.error(JSON.stringify({logType:'scoring_error',taskId:id,stage:job.action,durationMs:job.startedAt?Date.now()-Date.parse(job.startedAt):undefined,errorCode,at:new Date().toISOString()}));}
 const conn=await getPool().connect();
 try{
  await conn.query('BEGIN');const fresh=await conn.query('SELECT data FROM hiring_tasks WHERE id=$1 FOR UPDATE',[id]);const current=fresh.rows[0]?.data as HiringTask|undefined;
  if(current&&canPublish(current,job.id)){
   const person=current.candidates.find(item=>item.id===job.candidateId);
   if(person){
    if(result){if(job.action==='assess'||job.action==='reassess'){if(person.assessment)person.assessmentHistory=[...(person.assessmentHistory||[]),person.assessment];person.assessment=result;}else{if(person.screening)person.screeningHistory=[...(person.screeningHistory||[]),person.screening];person.screening=result;}}
    updateScoringJob(current,{...job,status:result?'succeeded':'failed',finishedAt:new Date().toISOString(),error,errorCode});current.audit.push({at:new Date().toISOString(),candidateId:job.candidateId,action:result?'后台评分完成，结果已保存':`后台评分未完成（${errorCode}），可重试`});await conn.query('UPDATE hiring_tasks SET data=$2::jsonb,version=version+1,updated_at=now() WHERE id=$1',[id,JSON.stringify(current)]);
   }
  }
  await conn.query('COMMIT');
 }catch(cause){await conn.query('ROLLBACK');throw cause;}finally{conn.release();}
 return true;
}
