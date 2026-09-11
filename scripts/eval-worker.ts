import {processEvaluationRun} from "../src/server/evaluation/runner";
import {recordHeartbeat} from "../src/server/observability/heartbeat";
console.info("HireLens evaluation worker started");
let nextHeartbeat=0;
while(true){try{if(Date.now()>=nextHeartbeat){await recordHeartbeat('evaluation-worker');nextHeartbeat=Date.now()+10000;}if(await processEvaluationRun())continue;}catch{console.error(JSON.stringify({logType:'worker_error',service:'evaluation-worker',errorCode:'WORKER_LOOP_FAILED',at:new Date().toISOString()}));}await new Promise(resolve=>setTimeout(resolve,1800));}
