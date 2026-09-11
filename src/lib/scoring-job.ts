import type { HiringTask } from './workflow';
import type { OperationalErrorCode } from './operational-errors';
export type ScoringJob = { id:string; candidateId:string; action:'screen'|'rescreen'|'assess'|'reassess'; status:'queued'|'running'|'succeeded'|'failed'|'cancelled'; queuedAt:string; startedAt?:string; finishedAt?:string; error?:string; errorCode?:OperationalErrorCode };
export function scoringActive(job?:ScoringJob){return job?.status==='queued'||job?.status==='running';}
export function scoringLabel(job?:ScoringJob){return !job?'':({queued:'等待后台评分',running:'后台评分中',succeeded:'评分已完成',failed:'评分失败，可重试',cancelled:'评分已取消'})[job.status];}
export function canPublish(task:HiringTask,jobId:string){return !task.deletedAt&&!task.archivedAt&&task.scoringJob?.id===jobId&&task.scoringJob.status==='running';}
