import assert from 'node:assert/strict';
import pg from 'pg';

if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const id=crypto.randomUUID();
const owner=`queue-smoke-${id}@example.invalid`;
const now=new Date().toISOString();
const person=name=>({id:crypto.randomUUID(),name,synthetic:true,filename:`${name}.txt`,resume:'用于多候选人队列验证的合成简历内容。',resumeConfirmed:true,sources:[],questions:[],answers:{},interviewComplete:false});
const first=person('候选人甲'),second=person('候选人乙');
const firstJob={id:crypto.randomUUID(),candidateId:first.id,action:'screen',status:'running',queuedAt:now,startedAt:now};
const task={id,title:'多候选人队列冒烟测试',jd:'用于验证一位候选人评分时仍可保存另一位候选人。',synthetic:true,confirmed:true,criteria:[],candidates:[first,second],audit:[],scoringJob:firstJob,scoringJobs:[firstJob]};
const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});
const save=async(data,version)=>pool.query(`UPDATE hiring_tasks SET data=$4::jsonb,version=version+1,updated_at=now()
 WHERE id=$1 AND owner_email=$2 AND version=$3
 AND COALESCE(data->>'archivedAt',data->>'deletedAt') IS NULL RETURNING data,version`,[id,owner,version,JSON.stringify(data)]);

try{
 await pool.query('INSERT INTO hiring_tasks(id,owner_email,version,data) VALUES($1,$2,1,$3::jsonb)',[id,owner,JSON.stringify(task)]);
 task.candidates[1].resume='另一位候选人的资料可在首位候选人评分时继续保存。';
 let result=await save(task,1);
 assert.equal(result.rowCount,1,'首位候选人评分时未能保存另一位候选人');
 const secondJob={id:crypto.randomUUID(),candidateId:second.id,action:'screen',status:'queued',queuedAt:new Date().toISOString()};
 task.scoringJobs.push(secondJob);task.scoringJob=secondJob;
 result=await save(task,2);
 assert.equal(result.rowCount,1,'未能将第二位候选人加入评分队列');
 const saved=result.rows[0].data;
 assert.equal(saved.candidates[1].resume.includes('继续保存'),true);
 assert.deepEqual(new Set(saved.scoringJobs.filter(job=>['queued','running'].includes(job.status)).map(job=>job.candidateId)),new Set([first.id,second.id]));
 console.log(JSON.stringify({status:'passed',activeCandidates:2,optimisticVersion:result.rows[0].version}));
}finally{
 await pool.query('DELETE FROM hiring_tasks WHERE id=$1',[id]);
 await pool.end();
}
