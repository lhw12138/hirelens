import type {Source} from './workflow';
export type VectorSource=Source & {vector:number[]};
export type RagTrace={mode:'hybrid'|'keyword';modelKey?:string;algorithm:'rrf-mmr-v1'|'keyword-v1';cacheHit:boolean;indexedChunks:number;latencyMs:number;queries:{criterionId:string;keywordIds:string[];vectorIds:string[];selectedIds:string[]}[]};
export function validVectors(value:unknown,count:number,dimensions:number):number[][] {
 if(!Array.isArray(value)||value.length!==count)throw Error('Invalid embedding count');
 for(const v of value)if(!Array.isArray(v)||v.length!==dimensions||v.some(n=>typeof n!=='number'||!Number.isFinite(n))||v.every(n=>n===0))throw Error('Invalid embedding vector');
 return value as number[][];
}
export function cosine(a:number[],b:number[]){if(a.length!==b.length)throw Error('Vector dimensions differ');const dot=a.reduce((n,x,i)=>n+x*b[i],0);return dot/(Math.hypot(...a)*Math.hypot(...b)||1);}
export function keywordRank(sources:Source[],query:string){
 const tokens=[...new Set(query.toLowerCase().match(/[a-z0-9+#.]+/g)||[])];
 const chinese=query.match(/[\u4e00-\u9fff]+/g)||[];for(const run of chinese)for(let i=0;i<run.length-1;i++)tokens.push(run.slice(i,i+2));
 return sources.map(s=>({id:s.id,score:tokens.reduce((n,t)=>n+(s.text.toLowerCase().includes(t)?t.length:0),0)})).filter(s=>s.score>0).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));
}
export function fuseAndRerank(sources:VectorSource[],query:number[],keywordIds:string[],vectorIds:string[],limit:number){
 const map=new Map(sources.map(s=>[s.id,s]));const ranks=new Map<string,number>();
 for(const list of [keywordIds,vectorIds])for(const [i,id]of [...new Set(list)].entries())if(map.has(id))ranks.set(id,(ranks.get(id)||0)+1/(60+i+1));
 const max=Math.max(...ranks.values(),1/61);const selected:VectorSource[]=[];
 while(selected.length<limit&&ranks.size){const ordered=[...ranks].map(([id,rrf])=>{const s=map.get(id)!;const redundancy=Math.max(0,...selected.map(other=>cosine(s.vector,other.vector)));return{id,score:.55*rrf/max+.3*cosine(query,s.vector)-.15*redundancy};}).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id));const id=ordered[0].id;selected.push(map.get(id)!);ranks.delete(id);}
 return selected;
}
