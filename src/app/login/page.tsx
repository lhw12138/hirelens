'use client';
import {useState, useSyncExternalStore} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {LockKeyhole, ShieldCheck, UserPlus} from 'lucide-react';
import {accountPasswordError} from '@/lib/password-policy';

const subscribe=()=>()=>{};

export default function LoginPage(){
 const router=useRouter();
 const ready=useSyncExternalStore(subscribe,()=>true,()=>false);
 const [action,setAction]=useState<'login'|'register'>('login');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const registering=action==='register';

 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();if(!ready||busy)return;
  const form=new FormData(event.currentTarget);const password=String(form.get('password')||'');
  if(registering){
   const passwordError=accountPasswordError(password);
   if(passwordError){setError(passwordError);return;}
   if(password!==form.get('passwordConfirmation')){setError('两次输入的密码不一致。');return;}
  }
  setBusy(true);setError('');
  try{
   const response=await fetch('/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,email:form.get('email'),password})});
   const data=await response.json().catch(()=>null) as {error?:string}|null;
   if(response.ok){router.replace('/');router.refresh();}
   else setError(data?.error||'账号操作未完成，请重试。');
  }catch{setError('连接暂时不可用，请重试。');}finally{setBusy(false);}
 }

 return <main className="candidate-shell"><section className="login-card">
  <div className="candidate-brand"><span>MT</span><div><strong>MeritTrace</strong><small>招聘决策工作台</small></div></div>
  <h1>{registering?'创建你的招聘工作台':'欢迎回来'}</h1>
  <p>{registering?'岗位、候选人和报告只对这个账号可见。':'进入你的证据审核与招聘决策工作台。'}</p>
  <div className="hr-auth-tabs" role="tablist" aria-label="招聘方账号操作">
   <button type="button" role="tab" aria-selected={!registering} className={!registering?'active':''} onClick={()=>{setAction('login');setError('');}}>登录</button>
   <button type="button" role="tab" aria-selected={registering} className={registering?'active':''} onClick={()=>{setAction('register');setError('');}}>注册</button>
  </div>
  <form method="post" onSubmit={submit}>
   <label>邮箱<input name="email" type="email" autoComplete="email" maxLength={254} required/>{registering?<small>仅作为登录账号，当前不会发送验证邮件。</small>:null}</label>
   <label>密码<input name="password" type="password" minLength={registering?8:1} maxLength={72} autoComplete={registering?'new-password':'current-password'} aria-describedby={registering?'hr-password-hint':undefined} required/>{registering?<small id="hr-password-hint">至少 8 位；大小写字母、数字、特殊字符任选两类</small>:null}</label>
   {registering?<label>确认密码<input name="passwordConfirmation" type="password" minLength={8} maxLength={72} autoComplete="new-password" required/></label>:null}
   <div className="login-error" aria-live="polite">{error}</div>
   <button disabled={!ready||busy} className="primary-button">{registering?<UserPlus size={16}/>:<LockKeyhole size={16}/>} {busy?(registering?'正在创建…':'正在登录…'):(registering?'创建并进入':'进入工作台')}</button>
  </form>
  <Link href="/candidate/login" className="candidate-login-link">我是候选人，进行简历匹配分析 →</Link>
  <small><ShieldCheck size={13}/> 每个招聘账号的数据空间相互隔离</small>
 </section></main>;
}
