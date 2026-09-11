"use client";
import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, ShieldCheck } from "lucide-react";
const subscribe = () => () => {};
export default function LoginPage(){
 const router=useRouter();
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();if(!ready||busy)return;const form=new FormData(event.currentTarget);setBusy(true);setError("");try{const response=await fetch("/api/auth/login",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(form))});if(response.ok){router.replace("/");router.refresh()}else setError("邮箱或密码不正确");}catch{setError("连接暂时不可用，请重试。");}finally{setBusy(false);}}
 return <main className="candidate-shell"><section className="login-card"><div className="candidate-brand"><span>HL</span><div><strong>HireLens</strong><small>招聘决策工作台</small></div></div><p className="candidate-kicker">组织管理员登录</p><h1>欢迎回来</h1><p>首版仅开放单组织管理员账号。</p><form method="post" onSubmit={submit}><label>邮箱<input name="email" type="email" defaultValue="admin@hirelens.local" required/></label><label>密码<input name="password" type="password" defaultValue="hirelens-demo" required/></label>{error?<span className="login-error">{error}</span>:null}<button disabled={!ready||busy} className="primary-button"><LockKeyhole size={15}/>进入工作台</button></form><small><ShieldCheck size={13}/> 演示账号仅用于本地合成数据</small></section></main>
}
