"use client";
import { useEffect, useState } from "react";
import {scoringActive,scoringLabel} from "@/lib/scoring-job";
import Link from "next/link";
import { InterviewNoticePanel } from "@/components/interview-notice-panel";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, Download, FileUp, Link2Off, LoaderCircle, Plus, RefreshCw, ShieldCheck, Trash2, Users } from "lucide-react";
import { COMBINED_POLICY, SCREENING_POLICY, currentStep, screeningValue, steps, sampleAnswers, sampleResume, type TaskRecord, type Person, type Criterion, type Assessment } from "@/lib/workflow";
import type { ScoringJob } from "@/lib/scoring-job";
import { hardRequirementLabel, hardRequirementResult } from "@/lib/candidate-comparison";

function rememberCandidate(person?:Person){if(!person)return;const url=new URL(window.location.href);url.searchParams.set("candidate",person.id);window.history.replaceState(null,"",url);}
function restoredPerson(people:Person[]){const id=new URL(window.location.href).searchParams.get("candidate");return people.find(p=>p.id===id)||people.find(p=>!p.review)||people[0];}

function ScoringProgress({job}:{job:ScoringJob}){
  const [seconds,setSeconds]=useState(0);
  useEffect(()=>{const timer=setInterval(()=>setSeconds(value=>value+1),1000);return()=>clearInterval(timer);},[]);
  const queued=job.status==="queued";const slow=queued?seconds>=20:seconds>=90;
  const title=queued?"评分已提交，正在等待后台接单":job.action==="assess"||job.action==="reassess"?"正在检索简历和面试证据":"正在检索简历证据并生成评分";
  const detail=slow?(queued?"等待时间较长，后台服务可能繁忙或尚未启动。请点“重新读取进度”；资料不会丢失。":"模型响应比通常更慢，系统仍在后台处理；10分钟超时后会保留资料并允许重试。"):`已等待 ${seconds} 秒 · ${queued?"通常几秒内开始":"通常需要30–90秒"}，可以离开本页面。`;
  return <section className={`hl-scoring-progress${slow?" is-slow":""}`} role="status" aria-live="polite"><LoaderCircle size={20}/><div><strong>{title}</strong><p>{detail}</p></div><span className="hl-progress-track" aria-hidden="true"><i/></span></section>;
}

type Act = (input: Record<string, unknown>, label: string) => Promise<void>;
type LifecycleAct = (input: Record<string, unknown>, label: string) => Promise<void>;
function weightedTotal(scores:Record<string,number|null|undefined>,criteria:Criterion[]){
  const totalWeight=criteria.reduce((sum,item)=>sum+item.weight,0);
  if(!totalWeight||criteria.some(item=>typeof scores[item.id]!=="number"))return null;
  return criteria.reduce((sum,item)=>sum+(scores[item.id] as number)*item.weight,0)/totalWeight;
}
export function GuidedTask({ id }: { id: string }) {
  const [row,setRow]=useState<TaskRecord|null>(null);
  const [selected,setSelected]=useState("");
  const [step,setStep]=useState(0);
  const [adding,setAdding]=useState(false);
  const [busy,setBusy]=useState("");
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [rubricDirty,setRubricDirty]=useState(false);
  async function load(){try{const r=await fetch("/api/tasks/"+id);const data=await r.json();if(!r.ok)throw new Error(data.error);setRow(data);const p=restoredPerson(data.data.candidates);rememberCandidate(p);setSelected(p?.id||"");setStep(currentStep(data.data,p));setError("");}catch(e){setError((e as Error).message);}}
  useEffect(()=>{const controller=new AbortController();fetch("/api/tasks/"+id,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw new Error(data.error);setRow(data);const p=restoredPerson(data.data.candidates);rememberCandidate(p);setSelected(p?.id||"");setStep(currentStep(data.data,p));}).catch(e=>{if(e.name!=="AbortError")setError(e.message);});return()=>controller.abort();},[id]);
  const background=scoringActive(row?.data.scoringJob);
  useEffect(()=>{
    if(!background)return;
    const controller=new AbortController();
    const timer=setInterval(()=>{fetch("/api/tasks/"+id,{signal:controller.signal}).then(async r=>{const data=await r.json();if(!r.ok)throw Error(data.error);setRow(data);}).catch(e=>{if(e.name!=="AbortError")setError("暂时无法读取后台进度，请重新读取。评分不会因离开页面而取消。");});},2500);
    return()=>{controller.abort();clearInterval(timer);};
  },[id,background]);
  const person=adding?undefined:row?.data.candidates.find(p=>p.id===selected);
  const act:Act=async(input,label)=>{
    if(!row||busy||background)return;
    setBusy(label);setError("");setNotice("");
    try{
      const r=await fetch("/api/tasks/"+id,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...input,version:row.version})});
      const data=await r.json();if(!r.ok)throw new Error(data.error);
      setRow(data);setNotice(r.status===202?"已提交后台评分，可以切换页面，结果会自动保存。":input.action==="batch"?`已添加 ${Array.isArray(input.entries)?input.entries.length:0} 位候选人，每份简历独立保存。`:input.action==="removeCandidate"?"候选人已移除。":"已保存。");
      setRubricDirty(false);
      const p=input.action==="candidate"||input.action==="batch"?data.data.candidates.at(-1):data.data.candidates.find((p:Person)=>p.id===(input.candidateId||selected))||data.data.candidates[0];
      rememberCandidate(p);setSelected(p?.id||"");setAdding(false);
      setStep(currentStep(data.data,p));
    }catch(e){setError((e as Error).message);}finally{setBusy("");}
  };
  const lifecycle:LifecycleAct=async(input,label)=>{
    if(!row||busy||background)return;setBusy(label);setError("");setNotice("");
    try{const r=await fetch(`/api/tasks/${id}/lifecycle`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({...input,version:row.version})});const data=await r.json();if(!r.ok)throw Error(data.error);setRow(data);const next=data.data.candidates.find((candidate:Person)=>candidate.id===selected)||data.data.candidates[0];rememberCandidate(next);setSelected(next?.id||"");setAdding(!next);if(next)setStep(currentStep(data.data,next));setNotice(input.action==="deleteCandidate"?"候选人及全部关联资料已永久删除。":input.action==="revokeInvitation"?"候选人访问链接已撤销。":"数据保留期限已更新。");}
    catch(e){setError((e as Error).message);}finally{setBusy("");}
  };
  if(!row)return <div className="hl-empty">{error?<div role="alert"><h1>暂时无法打开任务</h1><p>{error}</p><button className="hl-secondary" onClick={load}>重试</button><Link href="/">返回首页</Link></div>:<p role="status">正在读取已保存的进度…</p>}</div>;
  const task=row.data;const available=currentStep(task,person);
  return <div className="hl-workflow">
    <Link href="/" className="hl-back"><ArrowLeft size={15}/>所有招聘任务</Link>
    <div className="hl-task-heading"><div><h1>{task.title||"新建招聘任务"}</h1><p>{task.synthetic?"合成体验 · 所有示例资料均为虚构。":"你的每一步确认都会保留记录。"} {person&&"当前候选人："+person.name}</p></div>
      <div className="hl-task-heading-actions">{task.candidates.length>1&&<Link className="hl-secondary" href={`/tasks/${id}/compare`}><Users size={16}/>比较候选人</Link>}{task.candidates.length>0&&<label className="hl-switch">切换候选人<select aria-label="切换候选人" disabled={!!busy} value={adding?"":selected} onChange={e=>{rememberCandidate(task.candidates.find(p=>p.id===e.target.value));setRubricDirty(false);setSelected(e.target.value);setAdding(false);setStep(currentStep(task,task.candidates.find(p=>p.id===e.target.value)));setError("");}}>{adding&&<option value="">添加新候选人</option>}{task.candidates.map(p=><option value={p.id} key={p.id}>{p.name}{p.review?" · 已确认":""}</option>)}</select></label>}</div>
    </div>
    <nav className="hl-steps" aria-label="招聘步骤">{steps.map((label,i)=><button key={label} aria-current={i===step?"step":undefined} disabled={i>available||!!busy} onClick={()=>{setRubricDirty(false);setStep(i);setError("");setNotice("");}}><span>{i<available?<Check size={16}/>:i+1}</span><strong>{label}</strong></button>)}</nav>
    {background&&row.data.scoringJob&&<ScoringProgress key={row.data.scoringJob.id+row.data.scoringJob.status} job={row.data.scoringJob}/>} 
    <div aria-live="polite" className="hl-feedback">{row.data.scoringJob?.status==="failed"&&!background?<div className="hl-scoring-failure" role="alert"><AlertTriangle size={18}/><div><strong>{scoringLabel(row.data.scoringJob)}</strong><p>{row.data.scoringJob.error||"候选人资料已保留，可以重新评分。"}</p><small>错误代码：{row.data.scoringJob.errorCode||"MODEL_FAILED"}</small></div><Link href="/health" className="hl-quiet">检查系统状态</Link></div>:row.data.scoringJob&&!background?<p role="status">{scoringLabel(row.data.scoringJob)}</p>:null}{busy?<p role="status">{busy} {busy.includes("评估")&&"提交后可离开页面，结果会自动保存。"}</p>:notice?<p>{notice}</p>:null}</div>
    {error&&<div role="alert" className="hl-error">{error}<button className="hl-quiet" onClick={load}>重新读取已保存进度</button>{error.includes("登录")&&<Link href="/login">去登录</Link>}</div>}
    <button className="hl-quiet" disabled={!!busy} onClick={load}><RefreshCw size={14}/>重新读取进度</button>
    <div className="hl-step-body" key={row.version+"-"+selected+"-"+step+"-"+adding}>
      {step===0&&<JobStep title={task.title} jd={task.jd} criteria={task.criteria} confirmed={task.confirmed} busy={!!busy||background} act={act} next={()=>setStep(1)}/>}
      {step===1&&<><ScreeningList people={task.candidates} criteria={task.criteria} selected={selected} busy={!!busy||background} act={act} choose={p=>{rememberCandidate(p);setRubricDirty(false);setSelected(p.id);setAdding(false);setStep(currentStep(task,p));}} add={()=>{setAdding(true);setNotice("");}} synthetic={task.synthetic}/>{(adding||!person||!person.resumeConfirmed)&&<ResumeStep person={person} synthetic={task.synthetic} busy={!!busy||background} act={act} next={()=>setStep(2)} onError={setError}/>}</>}
      {step===2&&person&&<InterviewRecord taskId={id} person={person} synthetic={task.synthetic} busy={!!busy||background} act={act} next={()=>setStep(3)} onError={setError}/>}
      {step===3&&person&&<><FinalRubric criteria={task.evaluationCriteria||task.criteria} locked={task.candidates.some(p=>!!p.assessment)} busy={!!busy||background} act={act} dirty={setRubricDirty}/><AssessmentStep person={person} criteria={task.evaluationCriteria||task.criteria} busy={!!busy||background||rubricDirty} act={act} title={task.title} add={()=>{setAdding(true);setStep(1);setNotice("");}}/></>}
    </div>
    {task.confirmed&&step===1&&!adding&&task.candidates.length>0&&<button className="hl-quiet hl-add" disabled={!!busy} onClick={()=>{setAdding(true);setStep(1);setNotice("");}}><Plus size={16}/>添加另一位候选人</button>}
    <DataLifecycle row={row} person={person} busy={!!busy||background} act={lifecycle}/>
    <details className="hl-history"><summary>查看本任务的操作记录（{task.audit.length}）</summary><ol>{[...task.audit].reverse().map((a,i)=><li key={i}><time>{new Date(a.at).toLocaleString("zh-CN")}</time><span>{a.action}</span></li>)}</ol></details>
  </div>;
}

function DataLifecycle({row,person,busy,act}:{row:TaskRecord;person?:Person;busy:boolean;act:LifecycleAct}){
  const retention=row.data.retentionDays==null?"forever":String(row.data.retentionDays);
  function removeCandidate(){if(!person)return;const entered=window.prompt(`这会永久删除“${person.name}”的简历、面试记录、评分、向量、通知地址和访问链接。\n\n请输入候选人称呼确认：${person.name}`);if(entered===null)return;void act({action:"deleteCandidate",candidateId:person.id,confirmName:entered},"正在永久删除候选人资料…");}
  return <details className="hl-data-lifecycle"><summary><ShieldCheck size={16}/>数据与隐私</summary><div className="hl-data-lifecycle-body"><div><h3>资料保存方式</h3><p>确认后的脱敏文本保存在当前配置的数据库与对象存储中，检索向量单独保存。评分时只把已脱敏、与岗位有关的证据发送给当前配置的外部模型。</p><label>任务归档后的保留期限<select value={retention} disabled={busy} onChange={event=>void act({action:"retention",days:event.target.value==="forever"?null:Number(event.target.value)},"正在更新保留期限…")}><option value="forever">长期保留，手动删除</option><option value="30">30 天后永久删除</option><option value="90">90 天后永久删除</option></select></label><small>期限从任务归档时开始计算；恢复任务会取消自动删除日期。</small></div>{person&&<div className="hl-candidate-privacy"><h3>{person.name} 的资料</h3><p>删除候选人会同时清理简历与面试文件、评分结果、RAG 向量、加密通知地址和访问链接，且无法恢复。</p><div>{person.invitation&&<button className="hl-secondary" disabled={busy} onClick={()=>void act({action:"revokeInvitation",candidateId:person.id},"正在撤销访问链接…")}><Link2Off size={15}/>撤销访问链接</button>}<button className="hl-danger-link" disabled={busy} onClick={removeCandidate}><Trash2 size={15}/>永久删除候选人</button></div></div>}</div></details>;
}

function JobStep({title:initialTitle,jd:initialJd,criteria:initialCriteria,confirmed,busy,act,next}:{title:string;jd:string;criteria:Criterion[];confirmed:boolean;busy:boolean;act:Act;next:()=>void}){
  const [title,setTitle]=useState(initialTitle);const [jd,setJd]=useState(initialJd);const [criteria,setCriteria]=useState(initialCriteria);const [manualMode,setManualMode]=useState(false);
  const total=criteria.reduce((n,c)=>n+c.weight,0);
  function useManualCriteria(){setManualMode(true);setCriteria([{id:"custom-1",name:"自定义维度 1",description:"写明要从简历核实的行动、产出或结果证据。",weight:34},{id:"custom-2",name:"自定义维度 2",description:"写明相关经验与可迁移经验的判断边界。",weight:33},{id:"custom-3",name:"自定义维度 3",description:"写明该维度的关键要求和不满足时的判断方式。",weight:33}]);}
  return <section><header className="hl-section-intro"><h2>{confirmed?"招聘要求已确认":"先说清楚，你要招什么样的人"}</h2><p>粘贴任意岗位 JD，AI 会先起草岗位专属的简历评分维度；你可以修改一部分，也可以全部重设。面试后的综合评估可使用另一套标准。</p></header>
    <fieldset disabled={confirmed||busy} className="hl-fields">
      <label>岗位名称<input value={title} onChange={e=>setTitle(e.target.value)} placeholder="例如：后端工程师、招商主管、财务会计" maxLength={100}/></label>
      <label>岗位描述（JD）<textarea rows={5} value={jd} onChange={e=>setJd(e.target.value)} placeholder="粘贴岗位职责与能力要求，至少30字" maxLength={15000}/></label>
    </fieldset>
    {!confirmed&&<div className="hl-model-actions"><button className="hl-secondary" disabled={busy||title.trim().length<2||jd.trim().length<30} onClick={()=>act({action:"parse",title,jd},"AI 正在根据 JD 生成岗位专属评分维度，通常需要 20–60 秒…")}>{criteria.length?"根据当前 JD 重新生成":"AI 生成评分维度"}<ArrowRight size={16}/></button>{criteria.length>0&&<button className="hl-quiet" disabled={busy} onClick={useManualCriteria}>全部改为自定义</button>}</div>}
    {criteria.length===0&&!confirmed?<div className="hl-criteria-empty"><h3>评分维度将在这里生成</h3><p>先填写岗位名称和完整 JD。系统不会默认套用产品经理、技术或其他岗位模板。</p></div>:null}
    {criteria.length>0&&<div className="hl-criteria"><div className="hl-section-title"><div><h3>简历初筛评分维度</h3><p>{manualMode?"已切换为完全自定义框架；请按你的招聘标准重写。":"AI 已根据当前 JD 起草，确认前不会用于任何候选人。"}</p></div><span className={total===100?"":"hl-invalid"}>权重合计 {total}%</span></div><p className="hl-help">可改名称、说明和权重。真正不可缺少的能力可设为硬性条件；它只改变风险分组，不会自动淘汰候选人。</p>
      <CriteriaEditor criteria={criteria} onChange={setCriteria} disabled={confirmed||busy}/>
    </div>}
    <div className="hl-footer-action"><span>{confirmed?"要求已锁定；如需改变招聘方向，请另建任务。":"确认后添加简历并查看筛选排名。"}</span>{confirmed?<button className="hl-primary" onClick={next}>继续添加候选人<ArrowRight size={16}/></button>:<div><button className="hl-quiet" disabled={busy||title.trim().length<2||jd.trim().length<30} onClick={()=>act({action:"job",title,jd,criteria,confirm:false},"正在保存草稿…")}>保存草稿</button><button className="hl-primary" disabled={busy||total!==100||criteria.length<3||title.trim().length<2||jd.trim().length<30} onClick={()=>act({action:"job",title,jd,criteria,confirm:true},"正在保存招聘要求…")}>确认要求，下一步<ArrowRight size={16}/></button></div>}</div>
  </section>;
}

function ResumeStep({person,synthetic,busy,act,next,onError}:{person?:Person;synthetic:boolean;busy:boolean;act:Act;next:()=>void;onError:(s:string)=>void}){
  const [name,setName]=useState(person?.name||"");const [resume,setResume]=useState(person?.resume||"");const [filename,setFilename]=useState(person?.filename||"粘贴的简历");const [contactToken,setContactToken]=useState("");const [parsing,setParsing]=useState(false);const [checked,setChecked]=useState(false);
  async function upload(file?:File){if(!file)return;if(file.size>8*1024*1024){onError("文件不能超过8MB。");return;}setParsing(true);onError("");try{const form=new FormData();form.append("file",file);const r=await fetch("/api/documents/parse",{method:"POST",body:form});const data=await r.json();if(!r.ok)throw new Error(data.error);setResume(data.redactedText);setContactToken(data.contactToken||"");setFilename(file.name);}catch(e){onError((e as Error).message);}finally{setParsing(false);}}
  return <section><header className="hl-section-intro"><h2>{person?.resumeConfirmed?"候选人资料已保存":person?"检查这份资料，再交给 AI":"添加一位候选人"}</h2><p>{person?"请查看下方文本，手动删除仍然存在的身份信息。邮箱已从评分文本移除，并在识别成功时单独加密保存用于面试通知。":"可以上传简历，也可以直接粘贴。系统会把邮箱与评分文本分开处理。"}</p></header>
    {!person&&<div className="hl-import-actions">{synthetic&&<button className="hl-secondary" disabled={busy||parsing} onClick={()=>{setName("候选人 A（合成）");setResume(sampleResume);setContactToken("");setFilename("合成简历.txt");}}>填入示例简历</button>}<label className="hl-secondary"><FileUp size={17}/>{parsing?"正在解析…":"上传 PDF / DOCX"}<input aria-label="上传简历文件" type="file" accept=".pdf,.docx" disabled={busy||parsing} onChange={e=>upload(e.target.files?.[0])} hidden/></label><span>最大8MB；扫描版请改用粘贴文本。</span></div>}
    <fieldset className="hl-fields" disabled={busy||parsing||person?.resumeConfirmed}>
      {!person&&<label>候选人称呼<input value={name} maxLength={60} onChange={e=>setName(e.target.value)} placeholder="建议用候选人 A 等代号"/></label>}
      <label>{person?"待确认的脱敏文本":"简历正文"}<textarea rows={12} value={resume} onChange={e=>setResume(e.target.value)} placeholder="在这里粘贴简历内容…" maxLength={30000}/></label>
    </fieldset>
    {person&&!person.resumeConfirmed&&<label className="hl-checkbox"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)} disabled={busy}/>我已检查评分文本，确认其中没有姓名、邮箱、电话等身份信息。</label>}
    <div className="hl-footer-action"><span>{person?.resumeConfirmed?"接下来按岗位要求收集面试回答。":person?"确认后保存文本与证据位置。":"原始文档用于解析，下一步由你确认用于评估的文本。"}</span>
      {person?.resumeConfirmed?<button className="hl-primary" onClick={next}>继续筛选<ArrowRight size={16}/></button>:<button className="hl-primary" disabled={busy||parsing||resume.trim().length<30||(!person&&!name.trim())||(!!person&&!checked)} onClick={()=>act(person?{action:"resume",candidateId:person.id,resume}:{action:"candidate",name,resume,filename,synthetic,contactToken:contactToken||undefined},"正在保存候选人资料…")}>{person?"确认资料，下一步":"保存并检查脱敏结果"}<ArrowRight size={16}/></button>}
    </div>
  </section>;
}


function AssessmentStep({person,criteria,busy,act,title,add}:{person:Person;criteria:Criterion[];busy:boolean;act:Act;title:string;add:()=>void}){
  const a=person.assessment;const review=person.review;
  const [scores,setScores]=useState<Record<string,number|null>>(review?.scores||Object.fromEntries(a?.scores.map(s=>[s.criterionId,s.score])||[]));
  const [reason,setReason]=useState(review?.reason||"");const [conflictNote,setConflictNote]=useState(review?.conflictNote||"");const [decision,setDecision]=useState<"advance"|"hold"|"reject">(review?.decision||"hold");const [checked,setChecked]=useState(false);
  function exportReport(){if(!a)return;const text=["# "+title,"候选人："+person.name,person.synthetic?"数据：合成资料":"",review?"状态：人工已确认":"状态：AI 草稿，待人工审核",a.summary,...a.scores.flatMap(s=>["\n## "+criteria.find(c=>c.id===s.criterionId)?.name,"证据状态："+(s.status==="supported"?"有原文依据":s.status==="conflict"?"信息冲突，待核实":"证据不足，低置信度"),"AI评分："+(s.score??"因冲突暂不评分"),"人工评分："+(scores[s.criterionId]??"暂不评分"),s.claim,...s.sourceIds.map(id=>{const source=person.sources.find(s=>s.id===id);return source?"> "+source.locator+"\n"+source.text:"";})]),"\n审核意见："+reason,"冲突核实："+conflictNote,"处理决定："+({advance:"进入下一轮",hold:"补充信息后再判断",reject:"不推进"}[decision]),"模型："+a.model,"生成时间："+a.createdAt].join("\n");const url=URL.createObjectURL(new Blob([text],{type:"text/markdown;charset=utf-8"}));const link=document.createElement("a");link.href=url;link.download="HireLens-评估记录.md";link.click();URL.revokeObjectURL(url);}
  if(!a)return <section className="hl-assess-start"><h2>资料齐了，生成一份有依据的评估。</h2><p>系统会逐项阅读简历与面试回答，给出原文引用。证据不足项会给出低置信度暂估分并明确标记；信息冲突仍留给你核实。</p><dl><div><dt>岗位要求</dt><dd>{criteria.length} 项</dd></div><div><dt>面试材料</dt><dd>{person.interviewRecord?"已确认记录":Object.keys(person.answers).length+" 题回答"}</dd></div><div><dt>当前状态</dt><dd>等待生成</dd></div></dl><button className="hl-primary" disabled={busy} onClick={()=>act({action:"assess",candidateId:person.id},"正在检索原文并生成评估…")}>生成候选人评估<ArrowRight size={16}/></button><p className="hl-help">通常需要约一分钟。失败后可以重试，资料不会丢失。</p></section>;
  const hasConflict=a.conflicts.length>0||a.scores.some(s=>s.status==="conflict");
  const supplementedScore=a.scores.some(s=>s.score===null&&scores[s.criterionId]!==null);
  const humanEdited=a.scores.some(s=>scores[s.criterionId]!==s.score);
  const aiScores=Object.fromEntries(a.scores.map(item=>[item.criterionId,item.score]));
  const aiTotal=weightedTotal(aiScores,criteria);
  const humanTotal=weightedTotal(scores,criteria);
  const displayedTotal=review?weightedTotal(review.scores,criteria):humanEdited?humanTotal:aiTotal;
  const scoredCount=criteria.filter(item=>typeof (review?.scores||scores)[item.id]==="number").length;
  const insufficientCount=a.scores.filter(item=>item.status==="insufficient").length;
  const legacyAssessment=a.scoringVersion!==COMBINED_POLICY;
  const scoreLabel=review?"最终人工总分":humanEdited?"人工评分草稿":insufficientCount?"AI 暂估综合分":"AI 综合分";
  const reasonLength=supplementedScore?8:4;
  const reviewChecks=[
    {done:reason.trim().length>=reasonLength,text:`填写审核意见（至少 ${reasonLength} 个字）`},
    ...(hasConflict?[{done:conflictNote.trim().length>=8,text:"填写冲突核实记录（至少 8 个字）"}]:[]),
    {done:checked,text:"勾选“我已核对评分与引用”"},
  ];
  const canSubmit=reviewChecks.every(item=>item.done);
  return <section><header className="hl-section-intro"><h2>{review?"评估已确认，判断依据已留存":"核对原文，形成你的判断"}</h2><p>{review?"你可以导出这份记录，或继续处理另一位候选人。":"先查看各项判断下的引用，必要时修改分数，再填写处理意见。"}</p></header>
    {legacyAssessment&&!review&&<section className="hl-score-policy-update"><div><strong>这份结果使用旧版“证据不足不计分”规则</strong><p>可以按新规则重新生成。旧结果会保留在历史记录中，不会覆盖原文。</p></div><button className="hl-secondary" disabled={busy} onClick={()=>act({action:"reassess",candidateId:person.id},"正在按暂估分新规则重新评估…")}>按新规则重新评估</button></section>}
    <section className={`hl-score-overview${displayedTotal===null?" is-pending":""}${insufficientCount&&displayedTotal!==null?" has-low-confidence":""}`} aria-label="候选人综合评分"><div><span>{scoreLabel}</span><strong>{displayedTotal===null?"待核实":displayedTotal.toFixed(1)}{displayedTotal!==null&&<small>/ 100</small>}</strong></div><div><p>{displayedTotal===null?`${scoredCount}/${criteria.length} 项已有分数；冲突项核实前不进入总分。`:insufficientCount?`总分包含 ${insufficientCount} 项证据不足的暂估匹配分。`:"根据当前综合评估维度与权重加权计算。"}</p><small>{review?"这是 HR 已确认的结果。":humanEdited?"这是尚未保存的人工评分草稿。":insufficientCount?"暂估分反映当前材料匹配程度，不代表候选人的真实能力。":"AI 分数仅供参考，最终结论由 HR 确认。"}</small></div></section>
    <p className="hl-summary">{a.summary}</p>
    <div className="hl-assessment-list">{a.scores.map(s=><article key={s.criterionId}><div className="hl-score-heading"><div><h3>{criteria.find(c=>c.id===s.criterionId)?.name}</h3><span className={s.status==="insufficient"?"is-insufficient":undefined}>{s.status==="supported"?"有原文依据":s.status==="conflict"?"存在待核实信息":"证据不足 · 低置信度暂估"}</span></div><label>人工评分（0–100）<input type="number" min={0} max={100} aria-label={criteria.find(c=>c.id===s.criterionId)?.name+"人工评分"} disabled={busy||!!review} placeholder="暂不评分" value={scores[s.criterionId]??""} onChange={e=>setScores({...scores,[s.criterionId]:e.target.value===""?null:Number(e.target.value)})}/><small>AI 建议：{s.score??"因冲突暂不评分"}{s.status==="insufficient"&&s.score!==null?"（暂估）":""}</small></label></div><p>{s.claim}</p>
      <details open={s.status==="conflict"}><summary>查看引用原文（{s.sourceIds.length}）</summary>{s.sourceIds.length===0?<p>没有足够证据。请在审核意见中说明需要补充什么。</p>:s.sourceIds.map(id=>{const source=person.sources.find(s=>s.id===id);return source&&<blockquote key={id}><cite>{source.kind==="resume"?"简历":"面试回答"} · {source.locator}</cite><p>{source.text}</p></blockquote>;})}</details></article>)}</div>
    {hasConflict&&<section className="hl-conflicts"><h3>有信息需要你核实</h3>{a.conflicts.map((c,i)=><div key={i}><strong>{c.topic}</strong><p>{c.description}</p><details><summary>对照两处原文</summary>{c.sourceIds.map(id=>{const source=person.sources.find(s=>s.id===id);return source?<blockquote key={id}><cite>{source.kind==="resume"?"简历":"面试回答"} · {source.locator}</cite><p>{source.text}</p></blockquote>:<p className="hl-error" key={id}>这条引用暂时无法显示，请重新生成评估后再确认。</p>;})}</details></div>)}<label>核实记录 <span className="hl-required">必填</span><textarea id="conflict-note" rows={3} required minLength={8} aria-invalid={conflictNote.length>0&&conflictNote.trim().length<8} disabled={busy||!!review} value={conflictNote} onChange={e=>setConflictNote(e.target.value)} placeholder="例如：尚未核实，需要补充项目起止时间；暂缓判断。"/><small>即使尚未核实，也请记录下一步要核实什么，至少 8 个字。</small></label></section>}
    <fieldset className="hl-fields hl-review-fields" disabled={busy||!!review}><label>你的处理意见<select value={decision} onChange={e=>setDecision(e.target.value as typeof decision)}><option value="hold">补充信息后再判断</option><option value="advance">进入下一轮</option><option value="reject">不推进</option></select></label><label>审核意见 / 修改分数的依据 <span className="hl-required">必填</span><textarea id="review-reason" rows={3} required minLength={reasonLength} aria-invalid={reason.length>0&&reason.trim().length<reasonLength} value={reason} onChange={e=>setReason(e.target.value)} placeholder="说明你的判断依据、已核实内容或仍需补充的信息。"/><small>{supplementedScore?"你补充了 AI 未评分的分数，请用至少 8 个字说明核实依据。":"请用至少 4 个字记录你的判断依据。"}</small></label>{!review&&<label className="hl-checkbox"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>我已核对评分与引用，确认以上处理意见。</label>}</fieldset>
    {!review&&<section className="hl-review-checks" id="review-submit-help" aria-live="polite"><strong>提交前检查</strong><ul>{reviewChecks.map(item=><li className={item.done?"is-done":""} key={item.text}>{item.done?<Check size={15}/>:<span aria-hidden="true"/>}{item.text}</li>)}</ul></section>}
    <div className="hl-footer-action">{review?<button className="hl-secondary" onClick={exportReport}><Download size={16}/>导出评估记录</button>:<span>{canSubmit?"已满足提交条件，确认后保留 AI 原结果和你的修改。":"完成上方待办后即可保存；冲突项可以暂不评分。"}</span>}{review?<button className="hl-primary" onClick={add}>继续添加候选人<Plus size={16}/></button>:<button className="hl-primary" aria-describedby="review-submit-help" disabled={busy||!canSubmit} onClick={()=>act({action:"review",candidateId:person.id,scores,reason,conflictNote,decision},"正在保存人工审核记录…")}>确认并保存评估<Check size={16}/></button>}</div>
    <details className="hl-technical"><summary>查看生成信息</summary><p>模型：{a.model} · 耗时：{(a.latencyMs/1000).toFixed(1)} 秒 · 输入 / 输出 Token：{a.inputTokens} / {a.outputTokens}</p><RetrievalInfo assessment={a}/></details>
  </section>;
}
function CriteriaEditor({criteria,onChange,disabled}:{criteria:Criterion[];onChange:(v:Criterion[])=>void;disabled:boolean}){
 function add(){const next=[...criteria,{id:"custom-"+crypto.randomUUID(),name:"新评估维度",description:"写明要从材料中核实的具体行动、产出或结果。",weight:1}];const base=Math.floor(100/next.length),remainder=100-base*next.length;onChange(next.map((item,index)=>({...item,weight:base+(index<remainder?1:0)})));}
 return <><div className="hl-criteria-editor">{criteria.map((c,i)=><div className="hl-criterion" key={c.id}><div><input aria-label={"第"+(i+1)+"项能力名称"} value={c.name} disabled={disabled} onChange={e=>onChange(criteria.map(x=>x.id===c.id?{...x,name:e.target.value}:x))}/><textarea rows={2} aria-label={c.name+"说明"} value={c.description} disabled={disabled} onChange={e=>onChange(criteria.map(x=>x.id===c.id?{...x,description:e.target.value}:x))}/><label className="hl-hard-toggle"><input type="checkbox" checked={!!c.mustHave} disabled={disabled} onChange={e=>onChange(criteria.map(x=>x.id===c.id?{...x,mustHave:e.target.checked,minimumScore:e.target.checked?(x.minimumScore||60):undefined}:x))}/>设为硬性条件</label>{c.mustHave&&<label className="hl-minimum-score">最低参考线<input type="number" min={1} max={100} value={c.minimumScore||60} disabled={disabled} aria-label={c.name+"硬性条件最低参考线"} onChange={e=>onChange(criteria.map(x=>x.id===c.id?{...x,minimumScore:Number(e.target.value)}:x))}/><span>分</span></label>}</div><label>权重 %<input type="number" min={1} max={100} aria-label={c.name+"权重"} value={c.weight} disabled={disabled} onChange={e=>onChange(criteria.map(x=>x.id===c.id?{...x,weight:Number(e.target.value)}:x))}/></label>{!disabled&&<button className="hl-quiet" aria-label={"移除"+c.name} disabled={criteria.length<=3} onClick={()=>onChange(criteria.filter(x=>x.id!==c.id))}>移除</button>}</div>)}</div>{!disabled&&<button className="hl-quiet" disabled={criteria.length>=8} onClick={add}><Plus size={15}/>添加评分维度并自动均分权重</button>}</>;
}
function FinalRubric({criteria,locked,busy,act,dirty}:{criteria:Criterion[];locked:boolean;busy:boolean;act:Act;dirty:(value:boolean)=>void}){
 const [items,setItems]=useState(criteria);const total=items.reduce((a,c)=>a+c.weight,0);
 const changed=JSON.stringify(items)!==JSON.stringify(criteria);
 return <details className="hl-final-rubric"><summary>综合评估标准 · {criteria.length} 项（{locked?"已用于评估":"可使用默认或自定义"}）</summary><p>这是面试后的综合评估标准，可与简历初筛不同。修改后须先保存；生成评估后锁定，保证候选人之间口径一致。</p><CriteriaEditor criteria={items} onChange={value=>{setItems(value);dirty(JSON.stringify(value)!==JSON.stringify(criteria));}} disabled={busy||locked}/><div className="hl-footer-action"><span>合计 {total}%{changed?" · 请保存后再生成评估":""}</span>{!locked&&<button className="hl-secondary" disabled={busy||total!==100||!changed} onClick={()=>act({action:"rubric",criteria:items},"正在保存综合评估标准…")}>保存综合评估标准</button>}</div></details>;
}
function ScreeningList({people,criteria,selected,busy,act,choose,add,synthetic}:{people:Person[];criteria:Criterion[];selected:string;busy:boolean;act:Act;choose:(p:Person)=>void;add:()=>void;synthetic:boolean}){
 const rankValue=(p:Person)=>p.screening?.scoringVersion===SCREENING_POLICY&&p.screening.retrieval?.mode==='hybrid'?screeningValue(p,criteria):null;
 const ranked=[...people].sort((a,b)=>{const order={met:0,none:0,verify:1,unmet:2};const ag=hardRequirementResult(a,criteria,"screening"),bg=hardRequirementResult(b,criteria,"screening");if(order[ag.state]!==order[bg.state])return order[ag.state]-order[bg.state];return(rankValue(b)??-1)-(rankValue(a)??-1);});
 const labels={supported:"直接匹配",low_match:"低匹配",partial_match:"部分 / 可迁移匹配",insufficient:"材料不足，无法判断",conflict:"存在冲突，待核实"};
 return <section className="hl-screening"><div className="hl-section-title"><div><h2>先筛简历，再选择面试人选</h2><p>初筛评的是简历与岗位的匹配度，不是候选人的全部能力。相关经历少可得低分，不等于无法评分。</p></div><button className="hl-secondary" disabled={busy} onClick={add}><Plus size={16}/>添加简历</button></div>
 <BatchImport busy={busy} act={act} synthetic={synthetic}/>
 {people.length===0?<p className="hl-help">先添加简历，确认脱敏文本后评分。</p>:<>
 <div className="hl-rank-list">{ranked.map((p,i)=>{
 const legacy=!!p.screening&&(p.screening.scoringVersion!==SCREENING_POLICY||p.screening.retrieval?.mode!=='hybrid');
 const canRescore=legacy&&!p.shortlisted&&!p.assessment&&!p.review;
 const total=rankValue(p);
 const gate=hardRequirementResult(p,criteria,"screening");
 return <article key={p.id} className={selected===p.id?"selected":""}><div><span className="hl-rank">{total!==null?i+1:"—"}</span><button className="hl-quiet" onClick={()=>choose(p)} disabled={busy}>{p.name}</button><small>{p.review?"评估已确认":p.shortlisted?"进入面试":!p.resumeConfirmed?"等待脱敏确认":p.screening?"初筛已评分":"等待评分"}</small>{p.screening&&gate.state!=="none"&&<em className={`hl-hard-badge is-${gate.state}`}>{hardRequirementLabel[gate.state]}</em>}</div>
 <div>{p.screening&&(legacy?<span className="hl-help">旧版评分 / 检索 · 可查看历史</span>:total===null?<span className="hl-help">有待补充或核实项，暂不排名</span>:<span className="hl-ranking-score">{total.toFixed(1)}<small>岗位匹配分</small></span>)}
 {!p.resumeConfirmed?<button className="hl-secondary" disabled={busy} onClick={()=>choose(p)}>检查资料</button>:!p.screening?<button className="hl-primary" disabled={busy} onClick={()=>act({action:"screen",candidateId:p.id},"正在评估 "+p.name+" 的简历…")}>评分简历</button>:<>
 {canRescore&&<button className="hl-primary" disabled={busy} onClick={()=>act({action:"rescreen",candidateId:p.id},"正在按新规则评估简历，旧结果将保留…")}>按新规则重新评分</button>}
 {!p.shortlisted?<button className={canRescore?"hl-secondary":"hl-primary"} disabled={busy} onClick={()=>act({action:"shortlist",candidateId:p.id},"正在保存面试人选…")}>选择进入面试</button>:<button className="hl-secondary" disabled={busy} onClick={()=>choose(p)}>查看此候选人</button>}</>}
 {!p.shortlisted&&!p.assessment&&!p.review&&<button className="hl-danger-link" aria-label={`移除${p.name}`} disabled={busy} onClick={()=>{if(confirm(`移除“${p.name}”？该候选人的简历和评分将从本任务中删除。`))void act({action:"removeCandidate",candidateId:p.id},"正在移除候选人…");}}><Trash2 size={14}/>移除</button>}</div>
 {p.screening&&<details><summary>查看评分依据 · 已评分 {p.screening.scores.filter(s=>s.score!==null).length}/{criteria.length} 项</summary>
 {legacy&&<p>这份历史结果使用了旧评分规则或关键词召回。尚未进入面试的候选人可使用混合 RAG 重评，原结果保留；后续流程中的历史评分不改写。</p>}
 <p>{p.screening.summary}</p>{p.screening.scores.map(s=><div className="hl-screening-score" key={s.criterionId}><strong>{criteria.find(c=>c.id===s.criterionId)?.name} · {s.score??"暂不评分"} · {labels[s.status]}</strong><p>{s.claim}</p>{s.sourceIds.map(id=>{const source=p.sources.find(x=>x.id===id);return source&&<blockquote key={id}><cite>{source.locator}</cite><p>{source.text}</p></blockquote>;})}</div>)}
 <RetrievalInfo assessment={p.screening}/>
 {!!p.screeningHistory?.length&&<details><summary>查看重评前的记录（{p.screeningHistory.length}）</summary>{p.screeningHistory.map((a,index)=><div key={index}><p>{new Date(a.createdAt).toLocaleString("zh-CN")} · {a.scoringVersion||"旧版规则"}</p><p>{a.summary}</p>{a.scores.map(s=><p key={s.criterionId}>{criteria.find(c=>c.id===s.criterionId)?.name}：{s.score??"暂不评分"}。{s.claim}</p>)}</div>)}</details>}
 </details>}</article>;
 })}</div>
 <details className="hl-help"><summary>排名怎么计算？</summary><p>岗位匹配分 = 各维度评分 × 对应权重后相加。0–24分为低匹配；25–49分有可迁移经验；50–69分部分直接匹配；70–89分有直接行动与验证；90–100分有充分深入证据。这是初始评分规则，尚未经真实HR标注集校准。</p><p>完整可读的经历与要求不符时给低匹配分，并引用差距依据；材料严重缺失、无法读取或冲突才暂不评分。只要有暂不评分项，就不把它当0分计算总分或排名。仅相同新版规则、混合 RAG 且全部维度有分数的候选人参与排名，排名不自动淘汰。</p></details></>}
 </section>;
}
function InterviewRecord({taskId,person,synthetic,busy,act,next,onError}:{taskId:string;person:Person;synthetic:boolean;busy:boolean;act:Act;next:()=>void;onError:(s:string)=>void}){
 const [text,setText]=useState(person.interviewRecord||Object.entries(person.answers).map(([id,v])=>(person.questions.find(q=>q.id===id)?.text||"面试回答")+"\n"+v).join("\n\n"));
 const [checked,setChecked]=useState(false);const [parsing,setParsing]=useState(false);
 async function upload(file?:File){if(!file)return;if(file.size>8*1024*1024){onError("文件不能超过8MB。");return;}setParsing(true);try{if(file.name.endsWith(".txt"))setText(await file.text());else{const form=new FormData();form.append("file",file);const r=await fetch("/api/documents/parse",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw new Error(d.error);setText(d.redactedText);}}catch(e){onError((e as Error).message);}finally{setParsing(false);}}
 return <section><InterviewNoticePanel key={person.id} taskId={taskId} candidateId={person.id} candidateName={person.name} disabled={busy}/><header className="hl-section-intro"><h2>{person.interviewComplete?"面试记录已确认":"面试结束后，把记录放在这里"}</h2><p>已选择 {person.name} 进入面试。面试完成后，上传记录或粘贴文字。综合评估会同时读取简历和这份记录。</p></header>
 {!person.interviewComplete&&<div className="hl-import-actions">{synthetic&&<button className="hl-secondary" disabled={busy||parsing} onClick={()=>setText("【合成面试记录】\n\n"+Object.values(sampleAnswers).join("\n\n"))}>填入示例面试记录</button>}<label className="hl-secondary"><FileUp size={16}/>{parsing?"正在解析…":"上传面试记录"}<input type="file" accept=".pdf,.docx,.txt" aria-label="上传面试记录" hidden disabled={busy||parsing} onChange={e=>upload(e.target.files?.[0])}/></label><span>PDF / DOCX / TXT，最大8MB</span></div>}
 <label className="hl-record-label">面试记录（确认稿）<textarea rows={12} maxLength={30000} value={text} onChange={e=>setText(e.target.value)} disabled={busy||parsing||person.interviewComplete} placeholder="保留问题、候选人回答和面试官的观察，区分原话与个人判断。"/></label>
 {!person.interviewComplete&&<label className="hl-checkbox"><input type="checkbox" checked={checked} onChange={e=>setChecked(e.target.checked)}/>我已检查记录内容，并移除姓名、联系方式等不必要的身份信息。</label>}
 <div className="hl-footer-action"><span>{person.interviewComplete?"资料已保存，下一步综合评估。":"可先保存草稿，确认后用于评估。"}</span>{person.interviewComplete?<button className="hl-primary" onClick={next}>进入综合评估<ArrowRight size={16}/></button>:<div><button className="hl-quiet" disabled={busy||parsing||text.trim().length<30} onClick={()=>act({action:"record",candidateId:person.id,text,complete:false},"正在保存面试记录…")}>保存草稿</button><button className="hl-primary" disabled={busy||parsing||!checked||text.trim().length<30} onClick={()=>act({action:"record",candidateId:person.id,text,complete:true},"正在确认面试记录…")}>确认记录，下一步<ArrowRight size={16}/></button></div>}</div>
 </section>;
}
function BatchImport({busy,act,synthetic}:{busy:boolean;act:Act;synthetic:boolean}){
 const [parsing,setParsing]=useState("");const [error,setError]=useState("");
 async function upload(files:FileList|null){if(!files?.length)return;setError("");if(files.length>10){setError("每次最多导入10份简历。");return;}const entries=[];try{for(const [i,file]of Array.from(files).entries()){setParsing("正在解析 "+(i+1)+"/"+files.length);if(file.size>8*1024*1024)throw Error("第"+(i+1)+"份文件超过8MB。");const form=new FormData();form.append("file",file);const r=await fetch("/api/documents/parse",{method:"POST",body:form});const d=await r.json();if(!r.ok)throw Error("第"+(i+1)+"份文件："+d.error);entries.push({name:file.name.replace(/\.(pdf|docx)$/i,"").slice(0,60)||"候选人 "+(i+1),resume:d.redactedText,filename:file.name,contactToken:d.contactToken});}await act({action:"batch",entries},"正在创建 "+files.length+" 位候选人…");}catch(e){setError((e as Error).message);}finally{setParsing("");}}
 return <div className="hl-batch"><div className="hl-import-actions"><label className="hl-secondary"><FileUp size={16}/>{parsing||"批量添加候选人"}<input type="file" aria-label="批量添加候选人，每份简历一人" accept=".pdf,.docx" multiple hidden disabled={busy||!!parsing} onChange={e=>upload(e.target.files)}/></label>{synthetic&&<button className="hl-quiet" disabled={busy||!!parsing} onClick={()=>act({action:"batch",entries:[{name:"候选人 A（合成）",filename:"合成简历A.txt",resume:sampleResume},{name:"候选人 B（合成）",filename:"合成简历B.txt",resume:"【合成简历】\n邮箱：candidate-b@example.com\n经营分析经历：负责整理财务经营报表、核对指标口径，协助月度经营汇报。熟悉基础SQL和Excel。\n项目协作：参与报表系统需求讨论，负责整理用户问题与跟踪缺陷。尚未主导AI产品上线，也没有RAG或模型评测实践。"}]},"正在添加两位候选人…")}>添加两位示例候选人</button>}</div>{error&&<p className="hl-error" role="alert">{error}</p>}<p className="hl-help"><strong>一份文件代表一位候选人。</strong> 可同时选择最多10份 PDF/DOCX，系统会按文件名创建独立候选人；导入后逐份检查脱敏文本。识别到的邮箱单独加密保存，不进入评分。</p></div>;
}
function RetrievalInfo({assessment}:{assessment:Assessment}){
 const r=assessment.retrieval;
 return <details className="hl-technical"><summary>检索方式：{r?.mode==='hybrid'?'混合 RAG':r?.mode==='keyword'?'关键词对照模式':'旧记录（未保存检索明细）'}</summary>{r?<><p>{r.mode==='hybrid'?'关键词 + 本地多语言向量召回，经过 RRF 融合与 MMR 多样性排序。不是独立交叉编码器重排模型。':'本次显式使用关键词基线，未使用向量召回。'}</p><p>检索耗时 {(r.latencyMs/1000).toFixed(2)} 秒 · 向量来源 {r.cacheHit?'复用确认稿缓存':'本次建立 / 非向量模式'} · 索引原文 {r.indexedChunks} 段</p>{r.modelKey&&<p className="hl-help" style={{overflowWrap:'anywhere'}}>向量模型版本：{r.modelKey}</p>}<p>只检索当前候选人的已确认材料。原文未命中不等于不存在；引用仍需人工核对，尚无真实准确率结论。</p></>:<p>旧评估保留原状，不会补写成使用过混合 RAG。</p>}</details>;
}
