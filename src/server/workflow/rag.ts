import 'server-only';
import {createHash} from 'node:crypto';
import {getPool} from '@/server/db/client';
import {cosine, keywordRank, fuseAndRerank, validVectors, type VectorSource, type RagTrace} from '@/lib/hybrid-rag';
import type {HiringTask, Person, Source, Criterion} from '@/lib/workflow';

export class RagUnavailable extends Error {
 constructor(){super('混合 RAG 暂不可用，请确认本地向量服务已启动后重试。已保存资料不会丢失；本次没有退回关键词评分。');}
}
async function service(endpoint:string,body?:unknown){
 const base=process.env.RAG_LOCAL_URL||'http://127.0.0.1:3041';
 const r=await fetch(base+endpoint,{method:body?'POST':'GET',headers:{authorization:'Bearer '+(process.env.RAG_LOCAL_TOKEN||'hirelens-local-embeddings'),'content-type':'application/json'},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(body?60000:5000),cache:'no-store'});
 if(!r.ok)throw new RagUnavailable();
 return r.json();
}
async function embed(texts:string[],kind:'query'|'passage',modelKey:string){
 const result:number[][]=[];
 for(let i=0;i<texts.length;i+=8){const batch=texts.slice(i,i+8);const data=await service('/embed',{texts:batch,kind});if(data.modelKey!==modelKey)throw new RagUnavailable();result.push(...validVectors(data.vectors,batch.length,384));}
 return result;
}
export function snapshotFor(sources:Source[]){return createHash('sha256').update(JSON.stringify(sources.map(s=>[s.id,s.kind,s.locator,s.text]))).digest('hex');}
async function index(taskId:string,personId:string,sources:Source[],modelKey:string,persist=true){
 const db=getPool();const snapshot=snapshotFor(sources);const scope=[taskId,personId,snapshot,modelKey];
 const cached=persist?await db.query('SELECT source_id, embedding::text AS embedding FROM workflow_vectors WHERE task_id=$1 AND candidate_id=$2 AND snapshot=$3 AND model_key=$4',scope):{rows:[]};
 const ids=new Set(cached.rows.map(r=>r.source_id));
 const hit=ids.size===sources.length&&sources.every(s=>ids.has(s.id));
 if(hit)return{snapshot,cacheHit:true,sources:sources.map(s=>({...s,vector:validVectors([JSON.parse(cached.rows.find(r=>r.source_id===s.id).embedding)],1,384)[0]}))};
 // Long legacy answers are embedded in small windows; averaging retains all windows,
 // while the citation continues to refer to the immutable original source.
 const parts:{id:string;text:string}[]=[];
 for(const s of sources)for(let start=0;start<s.text.length;start+=280){parts.push({id:s.id,text:s.text.slice(start,start+320)});if(start+320>=s.text.length)break;}
 if(parts.length>600)throw new RagUnavailable();
 const vectors=await embed(parts.map(p=>p.text),'passage',modelKey);
 const indexed=sources.map(s=>{const v=Array<number>(384).fill(0);parts.forEach((p,i)=>{if(p.id===s.id)vectors[i].forEach((n,j)=>v[j]+=n);});const norm=Math.hypot(...v);if(!norm)throw new RagUnavailable();return{...s,vector:v.map(n=>n/norm)};});
 if(persist){const conn=await db.connect();try{await conn.query('BEGIN');for(const s of indexed)await conn.query('INSERT INTO workflow_vectors(task_id,candidate_id,snapshot,model_key,source_id,kind,embedding) VALUES($1,$2,$3,$4,$5,$6,$7::vector) ON CONFLICT DO NOTHING',[...scope,s.id,s.kind,JSON.stringify(s.vector)]);await conn.query('COMMIT');}catch(e){await conn.query('ROLLBACK');throw e;}finally{conn.release();}}
 return{snapshot,cacheHit:false,sources:indexed};
}
export async function prepareRetrieval(task:HiringTask,person:Person,criteria:Criterion[],phase:'screening'|'combined',persist=true){
 const started=Date.now();
 if(!task.confirmed||!person.resumeConfirmed||!task.candidates.some(p=>p.id===person.id)||(phase==='combined'&&!person.interviewComplete))throw new RagUnavailable();
 const sources=person.sources.filter(s=>s.text.trim()&&(phase==='combined'||s.kind==='resume'));
 const trace:RagTrace={mode:process.env.RAG_MODE==='keyword'?'keyword':'hybrid',algorithm:process.env.RAG_MODE==='keyword'?'keyword-v1':'rrf-mmr-v1',cacheHit:false,indexedChunks:0,latencyMs:0,queries:[]};
 const results=new Map<string,Source[]>();
 try{
  if(!sources.length)throw new RagUnavailable();
  let indexed:{snapshot:string;cacheHit:boolean;sources:VectorSource[]}|undefined;let queries:number[][]=[];
  if(trace.mode==='hybrid'){
   const health=await service('/health');if(health.dimensions!==384||typeof health.modelKey!=='string'||!health.ready)throw new RagUnavailable();
   trace.modelKey=health.modelKey;indexed=await index(task.id,person.id,sources,health.modelKey,persist);trace.cacheHit=indexed.cacheHit;trace.indexedChunks=sources.length;
   queries=await embed(criteria.map(c=>(c.name+'：'+c.description).slice(0,1000)),'query',health.modelKey);
  }
  for(const [i,c]of criteria.entries()){
   const selected:Source[]=[];const keywordIds:string[]=[];const vectorIds:string[]=[];
   // Separate quotas guarantee both resume and interview evidence in combined mode.
   for(const kind of (phase==='combined'?['resume','answer']:['resume'])){
    const subset=sources.filter(s=>s.kind===kind);const words=keywordRank(subset,c.name+' '+c.description).slice(0,12).map(s=>s.id);keywordIds.push(...words);
    if(indexed){
     const candidates=indexed.sources.filter(s=>s.kind===kind);
     const vector=persist
      ?(await getPool().query('SELECT source_id FROM workflow_vectors WHERE task_id=$1 AND candidate_id=$2 AND snapshot=$3 AND model_key=$4 AND kind=$5 ORDER BY embedding <=> $6::vector, source_id LIMIT 12',[task.id,person.id,indexed.snapshot,trace.modelKey,kind,JSON.stringify(queries[i])])).rows.map(r=>r.source_id as string)
      :candidates.map(source=>({id:source.id,score:cosine(queries[i],source.vector)})).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,12).map(item=>item.id);
     vectorIds.push(...vector);
     selected.push(...fuseAndRerank(candidates,queries[i],words,vector,phase==='combined'?4:8).map(s=>({id:s.id,kind:s.kind,locator:s.locator,text:s.text})));
    }else{const byId=new Map(subset.map(s=>[s.id,s]));selected.push(...(words.length?words:subset.map(s=>s.id)).slice(0,phase==='combined'?4:8).map(id=>byId.get(id)!));}
   }
   results.set(c.id,selected);trace.queries.push({criterionId:c.id,keywordIds,vectorIds,selectedIds:selected.map(s=>s.id)});
  }
  trace.latencyMs=Date.now()-started;return{results,trace};
 }catch{throw new RagUnavailable();}
}
