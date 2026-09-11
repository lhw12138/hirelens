import http from 'node:http';
import path from 'node:path';
import {readdir} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {pipeline, env} from '@huggingface/transformers';

const model='Xenova/multilingual-e5-small';
const cache=path.resolve(process.env.RAG_MODEL_CACHE||'.cache/e5');
env.cacheDir=cache;
// Public ModelScope copy is reachable from this deployment network.
env.remoteHost=process.env.RAG_MODEL_HOST||'https://modelscope.cn/';
env.remotePathTemplate='models/{model}/resolve/{revision}/';
env.allowRemoteModels=process.env.RAG_OFFLINE!=='true';
const encoder=await pipeline('feature-extraction',model,{dtype:'q8',device:'cpu',revision:process.env.RAG_MODEL_REVISION||'master'});
// Fingerprint actual cached weights/tokenizer, not just a mutable model name.
const hash=createHash('sha256');let weights=0;
async function fingerprint(dir){for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const file=path.join(dir,item.name);if(item.isDirectory())await fingerprint(file);else if(/\.(onnx|json|model)$/.test(item.name)){hash.update(path.relative(cache,file));for await(const chunk of createReadStream(file))hash.update(chunk);if(item.name.endsWith('.onnx'))weights++;}}}
await fingerprint(cache);if(!weights)throw Error('No cached ONNX weights found.');
const modelKey='e5-small-q8:'+hash.digest('hex');
const token=process.env.RAG_LOCAL_TOKEN||'hirelens-local-embeddings';
let active=false;
const server=http.createServer(async(req,res)=>{
 const reply=(status,data)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(data));};
 if(req.headers.origin||req.headers.authorization!=='Bearer '+token)return reply(403,{error:'forbidden'});
 if(req.method==='GET'&&req.url==='/health')return reply(200,{model,modelKey,dimensions:384,ready:true});
 if(req.method!=='POST'||req.url!=='/embed')return reply(404,{error:'not_found'});
 if(active)return reply(429,{error:'busy'});
 active=true;
 try{
  let body='';for await(const chunk of req){body+=chunk.toString();if(Buffer.byteLength(body)>100000)return reply(413,{error:'too_large'});}
  const data=JSON.parse(body);
  if(!['query','passage'].includes(data.kind)||!Array.isArray(data.texts)||data.texts.length<1||data.texts.length>16||data.texts.some(t=>typeof t!=='string'||!t.trim()||t.length>1600))return reply(400,{error:'invalid_input'});
  const output=await encoder(data.texts.map(t=>data.kind+': '+t),{pooling:'mean',normalize:true});
  reply(200,{modelKey,dimensions:384,vectors:output.tolist()});
 }catch{reply(500,{error:'embedding_failed'});}finally{active=false;}
});
server.requestTimeout=60000;server.headersTimeout=10000;
server.listen(Number(process.env.RAG_LOCAL_PORT||3041),process.env.RAG_LOCAL_HOST||'127.0.0.1',()=>console.log('Local embeddings ready: '+model+' (384 dimensions)'));
