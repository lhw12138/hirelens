import 'server-only';
import assert from 'node:assert/strict';
import {getPool} from '@/server/db/client';
import type {HiringTask, Person} from '@/lib/workflow';
import type {ScoringJob} from '@/lib/scoring-job';
import {processScoringJob} from '@/server/workflow/scoring-worker';

const id=crypto.randomUUID();
const owner=`worker-smoke-${id}@example.invalid`;
const person=(name:string):Person=>({id:crypto.randomUUID(),name,synthetic:true,filename:`${name}.txt`,resume:'用于后台队列验证的合成简历。',resumeConfirmed:true,sources:[],questions:[],answers:{},interviewComplete:false});
const first=person('候选人甲'),second=person('候选人乙');
const jobs:ScoringJob[]=[first,second].map((candidate,index)=>({id:crypto.randomUUID(),candidateId:candidate.id,action:'screen',status:'queued',queuedAt:new Date(Date.now()+index).toISOString()}));
const task:HiringTask={id,title:'多候选人 Worker 冒烟测试',jd:'用于验证后台依次处理同一任务中的多位候选人。',synthetic:true,confirmed:true,criteria:[],candidates:[first,second],audit:[],scoringJob:jobs.at(-1),scoringJobs:jobs};
const result={summary:'合成队列验证结果，不代表真实招聘判断。',scores:[],conflicts:[],model:'smoke-fake',latencyMs:1,inputTokens:0,outputTokens:0,createdAt:new Date().toISOString(),scoringVersion:'smoke-v1',retrieval:{mode:'keyword' as const,algorithm:'keyword-v1' as const,cacheHit:false,indexedChunks:0,latencyMs:0,queries:[]}};
const db=getPool();

try{
 await db.query('INSERT INTO hiring_tasks(id,owner_email,version,data) VALUES($1,$2,1,$3::jsonb)',[id,owner,JSON.stringify(task)]);
 assert.equal(await processScoringJob(async()=>result,id),true);
 assert.equal(await processScoringJob(async()=>result,id),true);
 assert.equal(await processScoringJob(async()=>result,id),false);
 const saved=(await db.query('SELECT data FROM hiring_tasks WHERE id=$1',[id])).rows[0].data as HiringTask;
 assert.equal(saved.scoringJobs?.filter(job=>job.status==='succeeded').length,2);
 assert.equal(saved.candidates.filter(candidate=>candidate.screening?.model==='smoke-fake').length,2);
 console.log(JSON.stringify({status:'passed',processedCandidates:2,remainingQueued:0}));
}finally{
 await db.query('DELETE FROM hiring_tasks WHERE id=$1',[id]);
 await db.end();
}
