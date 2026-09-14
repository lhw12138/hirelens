import {describe,it,expect} from 'vitest';
import {activeScoringJobs,canPublish,candidateScoringJob,queueScoringJob,scoringActive,scoringJobs,scoringLabel,updateScoringJob,type ScoringJob} from './scoring-job';
import type {HiringTask} from './workflow';
const job:ScoringJob={id:'one',candidateId:'person',action:'screen',status:'running',queuedAt:'now'};
describe('durable scoring state',()=>{
 it('only queued and running jobs lock edits',()=>{expect(scoringActive(job)).toBe(true);expect(scoringActive({...job,status:'queued'})).toBe(true);for(const status of ['failed','cancelled','succeeded'] as const)expect(scoringActive({...job,status})).toBe(false);});
 it('fences stale, cancelled, archived and legacy-deleted results',()=>{const task={scoringJob:job} as HiringTask;expect(canPublish(task,'one')).toBe(true);expect(canPublish(task,'old')).toBe(false);expect(canPublish({...task,archivedAt:'now'},'one')).toBe(false);expect(canPublish({...task,deletedAt:'now'},'one')).toBe(false);expect(canPublish({...task,scoringJob:{...job,status:'cancelled'}},'one')).toBe(false);});
 it('queues multiple candidates without losing legacy job compatibility',()=>{const task={scoringJob:job} as HiringTask;const second={...job,id:'two',candidateId:'person-2',status:'queued' as const};queueScoringJob(task,second);expect(scoringJobs(task).map(item=>item.id)).toEqual(['one','two']);expect(activeScoringJobs(task)).toHaveLength(2);expect(candidateScoringJob(task,'person-2')?.id).toBe('two');updateScoringJob(task,{...job,status:'succeeded'});expect(canPublish(task,'one')).toBe(false);expect(candidateScoringJob(task,'person-2')?.id).toBe('two');});
 it('labels failures honestly',()=>{expect(scoringLabel({...job,status:'failed'})).toContain('重试');expect(scoringLabel()).toBe('');});
});
