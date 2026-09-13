"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { LockKeyhole, ShieldCheck } from "lucide-react";
const subscribe = () => () => {};
export default function LoginPage(){
 const router=useRouter();
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!ready||busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError("");try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(form))});if(response.ok){router.replace("/");router.refresh()}else{const data=await response.json().catch(()=>null) as {error?:string}|null;setError(response.status===503&&data?.error?data.error:"邮箱或密码不正确");}}catch{setError("连接暂时不可用，请重试。");}finally{setBusy(false);}}
 return <main className="candidate-shell"><section className="login-card"><div className="candidate-brand"><span>MT</span><div><strong>MeritTrace</strong><small>招聘决策工作台</small></div></div><p className="candidate-kicker">组织管理员登录</p><h1>欢迎回来</h1><p>进入招聘方的证据审核与决策工作台。</p><form method="post" onSubmit={submit}><label>邮箱<input name="email" type="email" autoComplete="email" required/></label><label>密码<input name="password" type="password" autoComplete="current-password" required/></label>{error?<span className="login-error">{error}</span>:null}<button disabled={!ready||busy} className="primary-button"><LockKeyhole size={15}/>进入工作台</button></form><Link href="/candidate/login" className="candidate-login-link">我是候选人，进行简历匹配分析 →</Link><small><ShieldCheck size={13}/> 招聘方与候选人数据空间相互隔离</small></section></main>
}
