import { NextResponse } from "next/server";
import { requireOwner } from "@/server/workflow/store";
import { getPool } from "@/server/db/client";
import { objectStore } from "@/server/storage/object-store";
import { modelConfig } from "@/server/ai/provider";
import { getMailSettings } from "@/server/workflow/mail";
import { heartbeatState, overallHealth, type HealthService } from "@/lib/system-health";

function service(id:string,name:string,state:HealthService["state"],message:string,checkedAt:string,recovery?:string,href?:string):HealthService{return {id,name,state,message,checkedAt,recovery,href};}
async function checkRag(checkedAt:string){const url=(process.env.RAG_LOCAL_URL||"http://127.0.0.1:3041").replace(/\/$/,"")+"/health";try{const response=await fetch(url,{headers:{authorization:`Bearer ${process.env.RAG_LOCAL_TOKEN||"hirelens-local-embeddings"}`},signal:AbortSignal.timeout(2500),cache:"no-store"});if(!response.ok)throw Error("bad status");return service("rag","简历检索（RAG）","ok","语义检索与混合召回可用。",checkedAt);}catch{return service("rag","简历检索（RAG）","error","当前无法连接检索服务。",checkedAt,"确认本地检索服务已启动；运行 npm run dev 后再刷新。");}}
export async function GET(){try{const owner=await requireOwner();const checkedAt=new Date().toISOString();const services:HealthService[]=[];let databaseOk=true;
  try{await getPool().query("SELECT 1");services.push(service("database","数据库","ok","岗位、候选人和评分数据可正常读写。",checkedAt));}catch{databaseOk=false;services.push(service("database","数据库","error","当前无法连接数据服务。",checkedAt,"确认 Docker 中 PostgreSQL 已启动，然后刷新。"));}
  try{await objectStore.check();services.push(service("storage","文件存储","ok","简历和面试记录文件可正常读取。",checkedAt));}catch{services.push(service("storage","文件存储","error","当前无法连接文件存储。",checkedAt,"确认 Docker 中 MinIO 已启动，然后刷新。"));}
  services.push(await checkRag(checkedAt));
  if(databaseOk){const result=await getPool().query("SELECT service,last_seen FROM service_heartbeats WHERE service=$1",["scoring-worker"]);const seen=new Map<string,string>(result.rows.map(row=>[row.service,new Date(row.last_seen).toISOString()]));const state=heartbeatState(seen.get("scoring-worker"));services.push(service("scoring-worker","后台评分",state.state,state.message,checkedAt,state.recovery));}
  else services.push(service("scoring-worker","后台评分","warning","数据库不可用，暂时无法判断后台服务状态。",checkedAt,"先恢复数据库后再刷新。"));
  const configs=(["conversation","interview","review"] as const).map(modelConfig);const configured=configs.every(config=>Boolean(config.apiKey&&config.id));services.push(configured?service("model","模型配置","ok",`已配置 ${new Set(configs.map(c=>c.id)).size} 个模型。`,checkedAt):service("model","模型配置","error","模型密钥或模型名称未配置完整。",checkedAt,"检查本地 .env 中的模型配置后重新启动服务。"));
  try{const mail=databaseOk?await getMailSettings(owner):null;services.push(mail?service("mail","发信设置","ok",`已配置发信邮箱 ${mail.fromEmail}。`,checkedAt,undefined,"/settings/mail"):service("mail","发信设置","warning","尚未配置发信邮箱；不影响简历评分。",checkedAt,"需要发送面试通知时再配置。","/settings/mail"));}catch{services.push(service("mail","发信设置","warning","暂时无法读取发信设置。",checkedAt,"恢复数据库后再查看。","/settings/mail"));}
  return NextResponse.json({state:overallHealth(services),checkedAt,services});
}catch{return NextResponse.json({error:"登录已过期，请重新登录。"},{status:401});}}
