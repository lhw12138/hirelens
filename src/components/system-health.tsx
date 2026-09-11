"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, CircleX, RefreshCw } from "lucide-react";
import type { SystemHealth } from "@/lib/system-health";

const summary={ok:{title:"系统运行正常",detail:"招聘任务、文件、检索和后台处理均可使用。"},warning:{title:"核心功能可用，部分配置待完善",detail:"查看下方提示；未受影响的工作可以继续。"},error:{title:"部分功能暂不可用",detail:"先按下方恢复建议处理，再重试对应操作。"}};
export function SystemHealthView(){
  const [data,setData]=useState<SystemHealth|null>(null);const [error,setError]=useState("");const [loading,setLoading]=useState(true);
  const load=useCallback(async()=>{setLoading(true);setError("");try{const response=await fetch("/api/health",{cache:"no-store"});const value=await response.json();if(!response.ok)throw Error(value.error||"暂时无法读取系统状态。");setData(value);}catch(e){setError((e as Error).message);}finally{setLoading(false);}},[]);
  useEffect(()=>{let active=true;fetch("/api/health",{cache:"no-store"}).then(async response=>{const value=await response.json();if(!response.ok)throw Error(value.error||"暂时无法读取系统状态。");if(active)setData(value);}).catch(error=>{if(active)setError(error.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[]);
  const copy=data?summary[data.state]:summary.warning;
  return <div className="hl-health-page"><header className="hl-health-heading"><div><span>运行与恢复</span><h1>系统状态</h1><p>出问题时先看这里：每一项都会说明影响范围和恢复方法。</p></div><button className="hl-secondary" disabled={loading} onClick={()=>void load()}><RefreshCw size={16} className={loading?"is-spinning":""}/>{loading?"正在检查":"重新检查"}</button></header>
    {error?<div className="hl-error" role="alert">{error}<button className="hl-quiet" onClick={()=>void load()}>重试</button>{error.includes("登录")&&<Link href="/login">去登录</Link>}</div>:null}
    {data?<><section className={`hl-health-summary is-${data.state}`}><StateIcon state={data.state}/><div><h2>{copy.title}</h2><p>{copy.detail}</p><small>上次检查：{new Date(data.checkedAt).toLocaleString("zh-CN")}</small></div></section>
      <section className="hl-health-list" aria-label="服务检查结果">{data.services.map(item=><article key={item.id} className={`is-${item.state}`}><StateIcon state={item.state}/><div><header><h3>{item.name}</h3><strong>{item.state==="ok"?"正常":item.state==="warning"?"需留意":"需要处理"}</strong></header><p>{item.message}</p>{item.recovery?<small>{item.recovery}</small>:null}</div>{item.href?<Link className="hl-quiet" href={item.href}>打开设置</Link>:null}</article>)}</section></>:loading?<div className="hl-health-loading" role="status"><RefreshCw size={18} className="is-spinning"/>正在逐项检查数据库、文件、检索和后台服务…</div>:null}
  </div>;
}
function StateIcon({state}:{state:"ok"|"warning"|"error"}){return state==="ok"?<CheckCircle2 aria-label="正常"/>:state==="warning"?<AlertTriangle aria-label="需留意"/>:<CircleX aria-label="需要处理"/>;}
