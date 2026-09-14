import type { HiringTask } from './workflow';
import type { OperationalErrorCode } from './operational-errors';
export type ScoringJob = { id:string; candidateId:string; action:'screen'|'rescreen'|'assess'|'reassess'; status:'queued'|'running'|'succeeded'|'failed'|'cancelled'; queuedAt:string; startedAt?:string; finishedAt?:string; error?:string; errorCode?:OperationalErrorCode };
export function scoringActive(job?:ScoringJob){return job?.status==='queued'||job?.status==='running';}
export function scoringLabel(job?:ScoringJob){return !job?'':({queued:'等待后台评分',running:'后台评分中',succeeded:'评分已完成',failed:'评分失败，可重试',cancelled:'评分已取消'})[job.status];}
export function scoringJobs(task?:HiringTask){
 if(!task)return [];
 const jobs=task.scoringJobs||[];
 return task.scoringJob&&!jobs.some(job=>job.id===task.scoringJob?.id)?[...jobs,task.scoringJob]:jobs;
}
export function activeScoringJobs(task?:HiringTask){return scoringJobs(task).filter(scoringActive);}
export function candidateScoringJob(task:HiringTask|undefined,candidateId?:string){return !candidateId?undefined:[...scoringJobs(task)].reverse().find(job=>job.candidateId===candidateId&&scoringActive(job));}
export function latestScoringJob(task?:HiringTask){return [...scoringJobs(task)].sort((a,b)=>Date.parse(b.queuedAt)-Date.parse(a.queuedAt))[0];}
export function queueScoringJob(task:HiringTask,job:ScoringJob){
 task.scoringJobs=[...scoringJobs(task).filter(item=>item.id!==job.id),job].slice(-60);
 task.scoringJob=job;
}
export function updateScoringJob(task:HiringTask,job:ScoringJob){
 task.scoringJobs=[...scoringJobs(task).filter(item=>item.id!==job.id),job].sort((a,b)=>Date.parse(a.queuedAt)-Date.parse(b.queuedAt)).slice(-60);
 if(task.scoringJob?.id===job.id)task.scoringJob=job;
}
export function canPublish(task:HiringTask,jobId:string){return !task.deletedAt&&!task.archivedAt&&scoringJobs(task).some(job=>job.id===jobId&&job.status==='running');}
