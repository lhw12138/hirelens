"use client";
import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, ShieldCheck } from 'lucide-react';

export default function CandidateLoginPage() {
  const router = useRouter();
  const [action, setAction] = useState<'login' | 'register'>('login');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch('/api/candidate/auth', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action, email: form.get('email'), password: form.get('password'), accessCode: form.get('accessCode') }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      router.replace('/candidate'); router.refresh();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '暂时无法登录，请重试。'); }
    finally { setBusy(false); }
  }
  return <main className="candidate-auth">
    <section className="candidate-auth-copy">
      <Link href="/login" className="merit-wordmark"><span>MT</span><strong>MeritTrace</strong></Link>
      <h1>看清简历和岗位之间，<em>证据在哪里。</em></h1>
      <p>按岗位要求逐项核对你的简历，找到已经写清的经历，也找到需要补充事实的地方。</p>
      <ul><li>分析前自动隐藏邮箱、手机号、证件号与详细地址</li><li>不预测录用结果，不替招聘方作决定</li><li>报告只在你的账号中保存，可随时删除</li></ul>
    </section>
    <section className="candidate-auth-form" aria-labelledby="auth-title">
      <div className="auth-tabs" role="tablist"><button role="tab" aria-selected={action === 'login'} className={action === 'login' ? 'active' : ''} onClick={() => setAction('login')}>登录</button><button role="tab" aria-selected={action === 'register'} className={action === 'register' ? 'active' : ''} onClick={() => setAction('register')}>凭邀请注册</button></div>
      <h2 id="auth-title">{action === 'login' ? '继续你的材料自测' : '创建候选人账号'}</h2>
      <form onSubmit={submit}>
        <label>邮箱<input name="email" type="email" autoComplete="email" required /></label>
        <label>密码<input name="password" type="password" minLength={12} maxLength={72} autoComplete={action === 'login' ? 'current-password' : 'new-password'} required /></label>
        {action === 'register' && <label>邀请码<input name="accessCode" type="password" autoComplete="off" required /></label>}
        {error && <p className="candidate-error" role="alert">{error}</p>}
        <button className="candidate-main-action" disabled={busy}>{busy ? '正在处理…' : action === 'login' ? '进入个人空间' : '创建并进入'}<ArrowRight size={17}/></button>
      </form>
      <p className="candidate-auth-note"><ShieldCheck size={15}/> 候选人空间与招聘方工作台相互隔离</p>
    </section>
  </main>;
}
