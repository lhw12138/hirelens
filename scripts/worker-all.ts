import { processScoringJob } from "../src/server/workflow/scoring-worker";
import { processEvaluationRun } from "../src/server/evaluation/runner";
import { recordHeartbeat, type WorkerService } from "../src/server/observability/heartbeat";

async function loop(service:WorkerService, intervalMs:number, work:()=>Promise<boolean>){
  let nextHeartbeat=0;
  while(true){
    try{
      if(Date.now()>=nextHeartbeat){await recordHeartbeat(service);nextHeartbeat=Date.now()+10_000;}
      if(await work())continue;
    }catch{console.error(JSON.stringify({logType:"worker_error",service,errorCode:"WORKER_LOOP_FAILED",at:new Date().toISOString()}));}
    await new Promise(resolve=>setTimeout(resolve,intervalMs));
  }
}

console.info("HireLens combined worker started");
await Promise.all([
  loop("scoring-worker",1500,()=>processScoringJob()),
  loop("evaluation-worker",1800,()=>processEvaluationRun()),
]);
