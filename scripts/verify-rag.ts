import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {getPool} from '../src/server/db/client';
import {prepareRetrieval,RagUnavailable} from '../src/server/workflow/rag';
import {sampleCriteria,sampleJd,questionsFor,type HiringTask,type Person} from '../src/lib/workflow';

const id=randomUUID();const candidateId=randomUUID();
const person:Person={id:candidateId,name:'RAG验收候选人（合成）',synthetic:true,filename:'synthetic',resume:'合成资料',resumeConfirmed:true,questions:questionsFor(sampleCriteria),answers:{},interviewComplete:true,sources:[
 {id:'finance',kind:'resume',locator:'合成段落1',text:'梳理报销和对账流程，访谈财务与业务人员，定位人工核对附件的问题，先交付异常单据定位，再做辅助解释。'},
 {id:'product',kind:'resume',locator:'合成段落2',text:'编写PRD、用户故事、验收标准，按风险与频率确定优先级，协调研发与财务灰度上线并跟踪缺陷。'},
 {id:'semantic',kind:'resume',locator:'合成段落3',text:'生成答案的每句话都要有出处；找不到支持材料就拒绝作答。逐条人工核对原文是否支持回答，记录响应时间与调用用量。'},
 {id:'answer',kind:'answer',locator:'合成面试记录1',text:'我比较关键词和向量方案，检查无依据结论与引用准确性。先做小范围验证，再联合财务、研发验收上线。审批始终由人确认。'},
]};
const task:HiringTask={id,title:'混合RAG验收 · 合成',synthetic:true,confirmed:true,jd:sampleJd,criteria:sampleCriteria,candidates:[person],audit:[]};
const db=getPool();
try{
 await db.query('INSERT INTO hiring_tasks(id,owner_email,data) VALUES($1,$2,$3::jsonb)',[id,process.env.HR_ADMIN_EMAIL||'admin@hirelens.local',JSON.stringify(task)]);
 const first=await prepareRetrieval(task,person,sampleCriteria,'screening');assert.equal(first.trace.mode,'hybrid');assert.equal(first.trace.cacheHit,false);assert.ok([...first.results.values()].flat().every(s=>s.kind==='resume'));
 const second=await prepareRetrieval(task,person,sampleCriteria,'screening');assert.equal(second.trace.cacheHit,true);
 const combined=await prepareRetrieval(task,person,sampleCriteria,'combined');assert.ok([...combined.results.values()].every(s=>s.some(x=>x.kind==='answer')&&s.some(x=>x.kind==='resume')));
 const foreign={...person,id:randomUUID(),sources:[{id:'foreign',kind:'resume' as const,locator:'合成外部',text:'财务产品专属其他候选人的材料'}]};const otherTask={...task,candidates:[person,foreign]};
 await prepareRetrieval(otherTask,foreign,sampleCriteria,'screening');
 const isolated=await prepareRetrieval(otherTask,person,sampleCriteria,'screening');assert.ok([...isolated.results.values()].flat().every(s=>s.id!=='foreign'));
 const changed={...person,sources:person.sources.map(s=>({...s,text:s.text+' 补充合成记录。'}))};const changedResult=await prepareRetrieval({...task,candidates:[changed]},changed,sampleCriteria,'screening');assert.equal(changedResult.trace.cacheHit,false);
 const previous=process.env.RAG_LOCAL_URL;process.env.RAG_LOCAL_URL='http://127.0.0.1:1';await assert.rejects(()=>prepareRetrieval(task,person,sampleCriteria,'screening'),RagUnavailable);
 process.env.RAG_MODE='keyword';const baseline=await prepareRetrieval(task,person,sampleCriteria,'screening');assert.equal(baseline.trace.mode,'keyword');delete process.env.RAG_MODE;if(previous)process.env.RAG_LOCAL_URL=previous;else delete process.env.RAG_LOCAL_URL;
 const login=await fetch('http://localhost:3000/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:process.env.HR_ADMIN_EMAIL||'admin@hirelens.local',password:process.env.HR_ADMIN_PASSWORD||'hirelens-demo'})});assert.equal(login.status,200);const cookie=login.headers.get('set-cookie')!.split(';')[0];
 const result=await fetch('http://localhost:3000/api/tasks/'+id,{method:'POST',headers:{cookie,'content-type':'application/json'},body:JSON.stringify({action:'screen',candidateId,version:1}),signal:AbortSignal.timeout(240000)});let saved=await result.json();assert.equal(result.status,202,JSON.stringify(saved));
 const deadline=Date.now()+240000;while(['queued','running'].includes(saved.data.scoringJob.status)&&Date.now()<deadline){await new Promise(r=>setTimeout(r,1500));saved=await(await fetch('http://localhost:3000/api/tasks/'+id,{headers:{cookie}})).json();}
 assert.equal(saved.data.scoringJob.status,'succeeded','后台评分未成功；请先启动 scoring:worker');assert.equal(saved.data.candidates[0].screening.retrieval.mode,'hybrid');
 console.log(JSON.stringify({status:'passed',taskId:id,checks:['real local vectors','pgvector','cache reuse','candidate isolation','snapshot invalidation','both evidence types','fail closed','explicit keyword baseline','real model assessment'],retrieval:saved.data.candidates[0].screening.retrieval}));
}finally{await db.end();}
