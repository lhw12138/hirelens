import {processScoringJob} from '../src/server/workflow/scoring-worker';
import {recordHeartbeat} from '../src/server/observability/heartbeat';
console.info('HireLens scoring worker started');
let nextHeartbeat=0;
while(true){
 try{if(Date.now()>=nextHeartbeat){await recordHeartbeat('scoring-worker');nextHeartbeat=Date.now()+10000;}if(await processScoringJob())continue;}catch{console.error(JSON.stringify({logType:'worker_error',service:'scoring-worker',errorCode:'WORKER_LOOP_FAILED',at:new Date().toISOString()}));}
 await new Promise(resolve=>setTimeout(resolve,1500));
}
