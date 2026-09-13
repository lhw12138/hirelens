"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, FileText, LogOut, ShieldCheck, Trash2, Upload } from 'lucide-react';
import type { MatchRecord, MatchReport } from '@/lib/candidate-match';

const statusLabel: Record<string, string> = { supported: '证据较充分', partial_match: '部分匹配', low_match: '匹配较弱', insufficient: '材料不足', conflict: '信息待核实' };
export default function CandidatePage() {
  const router = useRouter();
  const [records, setRecords] = useState<MatchRecord[]>([]);
  const [active, setActive] = useState<MatchRecord | null>(null);
  const [title, setTitle] = useState(''); const [jd, setJd] = useState(''); const [resume, setResume] = useState('');
  const [consent, setConsent] = useState(false); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false); const [error, setError] = useState('');
  async function load() { const response = await fetch('/api/candidate/matches'); if (response.ok) { const data = await response.json(); setRecords(data.records); } }
  useEffect(() => { let ignore = false; fetch('/api/candidate/matches').then(response => response.ok ? response.json() : { records: [] }).then(data => { if (!ignore) setRecords(data.records); }); return () => { ignore = true; }; }, []);
  async function upload(file?: File) {
    if (!file) return; setUploading(true); setError(''); const form = new FormData(); form.set('file', file);
    try { const response = await fetch('/api/candidate/documents', { method: 'POST', body: form }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setResume(data.text); }
    catch (reason) { setError(reason instanceof Error ? reason.message : '无法读取文件。'); } finally { setUploading(false); }
  }
  async function analyze(event: React.FormEvent) {
    event.preventDefault(); if (busy) return; setBusy(true); setError('');
    try {
      const response = await fetch('/api/candidate/matches', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ requestId: crypto.randomUUID(), title, jd, resume, consent }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setActive(data.record); setTitle(''); setJd(''); setResume(''); setConsent(false); await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : '分析未完成，请重试。'); } finally { setBusy(false); }
  }
  async function remove(id: string) { if (!confirm('删除后无法恢复这份报告，确定继续吗？')) return; await fetch('/api/candidate/matches', { method: 'DELETE', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id }) }); if (active?.id === id) setActive(null); await load(); }
  async function logout() { await fetch('/api/candidate/auth', { method: 'DELETE' }); router.replace('/candidate/login'); router.refresh(); }
  return <main className="candidate-space">
    <header className="candidate-space-header"><div className="merit-wordmark"><span>MT</span><strong>MeritTrace</strong><small>候选人材料自测</small></div><button className="candidate-text-button" onClick={logout}><LogOut size={16}/>退出</button></header>
    <div className="candidate-workbench">
      <aside className="candidate-history"><h2>你的报告</h2><button className="new-match" onClick={() => setActive(null)}>＋ 新建匹配分析</button>{records.length ? records.map(record => <button key={record.id} className={active?.id === record.id ? 'history-row active' : 'history-row'} onClick={() => setActive(record)}><span>{record.title || '已删除'}</span><small>{record.status === 'complete' ? new Date(record.createdAt).toLocaleDateString('zh-CN') : '分析未完成'}</small></button>) : <p className="history-empty">完成第一份分析后，报告会出现在这里。</p>}</aside>
      <section className="candidate-main">
        {active?.report ? <MatchReportView report={active.report} title={active.title} onBack={() => setActive(null)} onDelete={() => remove(active.id)} /> : <>
          <div className="candidate-intro"><div><h1>简历 × JD 匹配分析</h1><p>它衡量的是“你当前写出来的证据”与岗位要求的贴合程度，不代表真实能力或录用概率。</p></div><span><ShieldCheck size={16}/>仅本人可见</span></div>
          <form className="match-form" onSubmit={analyze}>
            <label>目标岗位名称<input value={title} onChange={e => setTitle(e.target.value)} minLength={2} maxLength={100} placeholder="例如：AI 产品经理" required /></label>
            <label>岗位描述（JD）<textarea value={jd} onChange={e => setJd(e.target.value)} minLength={50} maxLength={15000} rows={8} placeholder="粘贴完整岗位职责和任职要求…" required/><small>{jd.length}/15000</small></label>
            <label>你的简历<textarea value={resume} onChange={e => setResume(e.target.value)} minLength={50} maxLength={30000} rows={12} placeholder="上传 PDF / DOCX，或粘贴简历文本…" required/><small>{resume.length}/30000</small></label>
            <label className="resume-upload"><Upload size={17}/><span>{uploading ? '正在读取并脱敏…' : '上传 PDF 或 DOCX'}</span><input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" disabled={uploading || busy} onChange={e => upload(e.target.files?.[0])}/></label>
            <label className="candidate-consent"><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} required/><span>我确认有权处理这份材料，并同意将自动脱敏后的简历文本和 JD 发送给本项目配置的第三方 AI 模型（当前为 DeepSeek API）生成报告。原文件不保存。</span></label>
            {error && <p className="candidate-error" role="alert">{error}</p>}
            <button className="candidate-main-action" disabled={busy || uploading || !consent}>{busy ? '正在逐项核对，约需 1–2 分钟…' : '开始匹配分析'}<ArrowRight size={17}/></button>
          </form>
        </>}
      </section>
    </div>
  </main>;
}

function MatchReportView({ report, title, onBack, onDelete }: { report: MatchReport; title: string; onBack: () => void; onDelete: () => void }) {
  return <article className="match-report"><header><div><button className="candidate-text-button" onClick={onBack}>← 返回新建</button><h1>{title}</h1><p>{report.assessment.summary}</p></div><button className="candidate-text-button danger" onClick={onDelete}><Trash2 size={16}/>删除报告</button></header>
    <section className="report-overview"><div><small>材料匹配度</small><strong>{report.overall === null ? '暂不汇总' : `${report.overall}`}</strong><span>{report.overall === null ? `可判断范围 ${report.coverage}%` : '/ 100'}</span></div><p><ShieldCheck size={17}/>这是简历证据覆盖情况，不是能力测评、排名或录用概率。</p></section>
    <h2>逐项证据</h2><div className="evidence-list">{report.criteria.map(criterion => { const score = report.assessment.scores.find(item => item.criterionId === criterion.id)!; const suggestion = report.improvements.find(item => item.criterionId === criterion.id); return <section key={criterion.id} className="evidence-row"><div className="evidence-score"><strong>{score.score ?? '—'}</strong><small>{criterion.weight}% 权重</small></div><div><div className="evidence-heading"><h3>{criterion.name}</h3><span data-state={score.status}>{statusLabel[score.status]}</span></div><p>{score.claim}</p>{score.sourceIds.map(id => { const source = report.sources.find(item => item.id === id); return source ? <blockquote key={id}><FileText size={14}/><span>{source.text}</span></blockquote> : null; })}{suggestion && <p className="improvement"><CheckCircle2 size={16}/><span><strong>改进方向：</strong>{suggestion.suggestion}</span></p>}</div></section>; })}</div>
  </article>;
}
