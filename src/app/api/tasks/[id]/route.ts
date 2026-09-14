import { NextResponse } from 'next/server';
import { z } from 'zod';
import { loadTask, requireOwner, saveTask, WorkflowError } from '@/server/workflow/store';
import {activeScoringJobs,candidateScoringJob,queueScoringJob} from '@/lib/scoring-job';
import {getPool} from '@/server/db/client';
import { parseJob } from '@/server/workflow/model';
import { COMBINED_POLICY, SCREENING_POLICY, criterionSchema, questionsFor, validateCriteria, validateReview, type Person } from '@/lib/workflow';
import { redactPersonalData } from '@/lib/redaction';
import { contactCipherFromInput, publicTaskRecord } from '@/server/workflow/candidate-contact';
import { chunkDocument } from '@/lib/chunking';
import { objectStore } from '@/server/storage/object-store';
import { failure } from '../route';
import { archiveTask, restoreTask, taskIsArchived } from '@/lib/data-lifecycle';
import {consumeHrAiUsage} from '@/server/auth/hr-usage';
const mutationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('batch'), entries: z.array(z.object({ name: z.string().trim().min(1).max(60), resume: z.string().trim().min(30).max(30000), filename: z.string().max(200), contactToken: z.string().max(5000).optional() })).min(1).max(10) }),
  z.object({ action: z.literal('rubric'), criteria: z.array(criterionSchema) }),
  z.object({ action: z.literal('screen'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('rescreen'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('shortlist'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('removeCandidate'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('record'), candidateId: z.string().uuid(), text: z.string().trim().min(30).max(30000), complete: z.boolean() }),
  z.object({ action: z.literal('job'), title: z.string().trim().min(2).max(100), jd: z.string().trim().min(30).max(15000), criteria: z.array(criterionSchema), confirm: z.boolean() }),
  z.object({ action: z.literal('parse'), title: z.string().trim().min(2).max(100), jd: z.string().trim().min(30).max(15000) }),
  z.object({ action: z.literal('candidate'), name: z.string().trim().min(1).max(60), resume: z.string().trim().min(30).max(30000), filename: z.string().max(200), synthetic: z.boolean(), contactToken: z.string().max(5000).optional() }),
  z.object({ action: z.literal('resume'), candidateId: z.string().uuid(), resume: z.string().trim().min(30).max(30000) }),
  z.object({ action: z.literal('answers'), candidateId: z.string().uuid(), answers: z.record(z.string(), z.string().max(6000)), complete: z.boolean() }),
  z.object({ action: z.literal('assess'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('reassess'), candidateId: z.string().uuid() }),
  z.object({ action: z.literal('review'), candidateId: z.string().uuid(), scores: z.record(z.string(), z.number().min(0).max(100).nullable()), reason: z.string().trim().min(4).max(2000), conflictNote: z.string().max(2000), decision: z.enum(['advance','hold','reject']) }),
]);
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  try { return NextResponse.json(publicTaskRecord(await loadTask(z.uuid().parse((await ctx.params).id), await requireOwner()))); } catch(e) { return failure(e); }
}
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner();
    const id = z.uuid().parse((await ctx.params).id);
    const body = await request.json();
    const version = z.number().int().positive().parse(body.version);
    const input = mutationSchema.parse(body);
    const row = await loadTask(id, owner);
    if (row.version !== version) throw new WorkflowError('任务已在其他页面更新，请刷新后继续。', 409);
    const task = row.data;
    const activeJobs=activeScoringJobs(task);
    if(activeJobs.length&&['rubric','job','parse'].includes(input.action))throw new WorkflowError('有候选人正在后台评分，评分标准暂时不能修改；仍可处理其他候选人。',409);
    let person: Person | undefined;
    if ('candidateId' in input) {
      person = task.candidates.find(p => p.id === input.candidateId);
      if (!person) throw new WorkflowError('找不到该候选人。', 404);
      if(candidateScoringJob(task,person.id))throw new WorkflowError('这位候选人正在排队或评分中；你可以先处理其他候选人。',409);
    }
    let action = '';
    if (input.action === 'rubric') {
      if (task.candidates.some(p => p.assessment)) throw new WorkflowError('已有综合评估使用这套标准，请新建任务比较其他标准。', 409);
      try { validateCriteria(input.criteria); } catch(e) { throw new WorkflowError((e as Error).message); }
      task.evaluationCriteria = input.criteria;
      action = '人工确认综合评估维度与权重';
    } else if (input.action === 'job' || input.action === 'parse') {
      if (task.confirmed) throw new WorkflowError('岗位要求已用于后续评估。修改要求请新建任务，避免覆盖已有结论。', 409);
      task.title = input.title;
      task.jd = redactPersonalData(input.jd).text;
      if (input.action === 'parse') {
        await consumeHrAiUsage(owner);
        task.criteria = await parseJob(task.jd);
        action = 'AI 整理招聘要求，等待人工确认';
      } else {
        if (input.confirm) { try { validateCriteria(input.criteria); } catch(e) { throw new WorkflowError((e as Error).message); } }
        task.criteria = input.criteria;
        task.confirmed = input.confirm;
        action = input.confirm ? '人工确认招聘要求' : '保存岗位草稿';
      }
    } else if (input.action === 'batch') {
      if (!task.confirmed) throw new WorkflowError('请先确认招聘要求。');
      if (task.candidates.length + input.entries.length > 30) throw new WorkflowError('本任务最多支持30名候选人。');
      for(const entry of input.entries) {
        const p: Person = {id:crypto.randomUUID(),name:entry.name,synthetic:task.synthetic,filename:entry.filename,resume:redactPersonalData(entry.resume).text.split(entry.name).join('[姓名已隐藏]'),resumeConfirmed:false,sources:[],questions:questionsFor(task.criteria),answers:{},interviewComplete:false,contactEmailsCiphertext:contactCipherFromInput(owner,entry.resume,entry.contactToken)};
        task.candidates.push(p);
      }
      action='批量添加'+input.entries.length+'份简历，等待逐份确认脱敏资料';
    } else if (input.action === 'candidate') {
      if (!task.confirmed) throw new WorkflowError('请先确认招聘要求。');
      if (task.candidates.length >= 30) throw new WorkflowError('本任务最多支持30名候选人，请另建任务。');
      if (!task.synthetic && input.synthetic) throw new WorkflowError('示例资料请在合成体验任务中使用。');
      person = { id: crypto.randomUUID(), name: input.name, synthetic: task.synthetic || input.synthetic, filename: input.filename, resume: redactPersonalData(input.resume).text.split(input.name).join('[姓名已隐藏]'), resumeConfirmed: false, sources: [], questions: questionsFor(task.criteria), answers: {}, interviewComplete: false, contactEmailsCiphertext: contactCipherFromInput(owner,input.resume,input.contactToken) };
      task.candidates.push(person);
      action = '添加候选人，等待确认脱敏资料';
    } else if (person) {
      if (input.action === 'removeCandidate') {
        if (person.shortlisted || person.interviewComplete || person.assessment || person.review) throw new WorkflowError('已进入面试或评估的候选人需要保留审计记录，不能直接删除。', 409);
        task.candidates = task.candidates.filter(candidate => candidate.id !== person!.id);
        action = '移除尚未进入面试的候选人';
      } else {
      if (person.review) throw new WorkflowError('这份评估已确认并归档，可在页面查看或导出。', 409);
      if (input.action === 'screen' || input.action === 'rescreen') {
        if (!person.resumeConfirmed) throw new WorkflowError('请先确认脱敏资料。');
        if (input.action === 'screen' && person.screening) throw new WorkflowError('简历已评分，请查看结果。',409);
        if (input.action === 'rescreen' && (!person.screening || (person.screening.scoringVersion === SCREENING_POLICY && (person.screening.retrieval?.mode === 'hybrid' || process.env.RAG_MODE === 'keyword')) || person.shortlisted || person.assessment)) throw new WorkflowError('只有尚未进入面试的旧版初筛可以按新规则重评；已进入后续流程的记录保持不变。',409);
        await consumeHrAiUsage(owner);
        queueScoringJob(task,{id:crypto.randomUUID(),candidateId:person.id,action:input.action,status:'queued',queuedAt:new Date().toISOString()});
        action='已提交后台简历评分';
      } else if (input.action === 'shortlist') {
        if (!person.screening) throw new WorkflowError('请先完成简历筛选评分。');
        person.shortlisted = true; action = 'HR选择候选人进入面试';
      } else if (input.action === 'record') {
        if (!person.shortlisted) throw new WorkflowError('请先筛选简历并选择进入面试。');
        if (person.interviewComplete) throw new WorkflowError('面试记录已确认，不能覆盖。',409);
        person.interviewRecord = redactPersonalData(input.text).text.split(person.name).join('[姓名已隐藏]');
        person.interviewComplete = input.complete;
        person.sources = person.sources.filter(s => s.kind === 'resume').concat(chunkDocument([{section:'面试记录确认稿',text:person.interviewRecord}]).map((c,i) => ({id:person!.id+'-interview-'+i,kind:'answer' as const,locator:c.section+' · 字符 '+(c.start+1)+'–'+c.end,text:c.text})));
        if(input.complete) {
          await objectStore.put('tasks/'+task.id+'/'+person.id+'/interview.txt',Buffer.from(person.interviewRecord),'text/plain; charset=utf-8');
          person.invitation = undefined;
        }
        action = input.complete ? 'HR确认面试记录并保存原文证据' : '保存面试记录草稿';
      } else if (input.action === 'resume') {
        if (person.resumeConfirmed) throw new WorkflowError('资料已经确认。', 409);
        person.contactEmailsCiphertext = contactCipherFromInput(owner,input.resume) || person.contactEmailsCiphertext;
        person.resume = redactPersonalData(input.resume).text.split(person.name).join('[姓名已隐藏]');
        person.sources = chunkDocument(person.resume.split(/\n{2,}/).map((text, i) => ({ section: `确认稿段落 ${i+1}`, text }))).map((c,i) => ({ id: `${person!.id}-r${i}`, kind: 'resume', locator: `${c.section} · 字符 ${c.start+1}–${c.end}`, text: c.text }));
        await objectStore.put(`tasks/${task.id}/${person.id}/redacted.txt`, Buffer.from(person.resume), 'text/plain; charset=utf-8');
        person.resumeConfirmed = true; action = '人工确认脱敏资料并保存证据';
      } else if (input.action === 'answers') {
        if (!person.shortlisted) throw new WorkflowError('请先完成简历筛选。');
        if (!person.resumeConfirmed) throw new WorkflowError('请先确认脱敏资料。');
        if (person.interviewComplete) throw new WorkflowError('面试记录已确认，不能覆盖。', 409);
        const known = new Set(person.questions.map(q => q.id));
        if (Object.keys(input.answers).some(id => !known.has(id))) throw new WorkflowError('问题不属于本场面试。');
        if (input.complete && person.questions.some(q => !input.answers[q.id]?.trim())) throw new WorkflowError('请补齐每题回答；无法回答时可以填写“不清楚”。');
        person.answers = Object.fromEntries(Object.entries(input.answers).map(([k,v]) => [k, redactPersonalData(v).text.split(person!.name).join('[姓名已隐藏]')]));
        person.interviewComplete = input.complete;
        person.sources = person.sources.filter(s => s.kind === 'resume').concat(person.questions.filter(q => person!.answers[q.id]?.trim()).map((q,i) => ({ id: `${person!.id}-${q.id}`, kind: 'answer' as const, locator: `面试第 ${i+1} 题 · ${task.criteria.find(c => c.id === q.criterionId)?.name}`, text: person!.answers[q.id] })));
        if (input.complete) person.invitation = undefined;
        action = input.complete ? '人工确认面试记录' : '保存面试回答草稿';
      } else if (input.action === 'assess' || input.action === 'reassess') {
        if (!person.interviewComplete) throw new WorkflowError('请先完成面试回答。');
        if (input.action === 'assess' && person.assessment) throw new WorkflowError('评估已生成，请直接审核。', 409);
        if (input.action === 'reassess' && (!person.assessment || person.assessment.scoringVersion === COMBINED_POLICY)) throw new WorkflowError('当前评估已经使用最新综合评估规则。', 409);
        if(!person.shortlisted||!person.resumeConfirmed)throw new WorkflowError('请先完成简历筛选。');
        await consumeHrAiUsage(owner);
        queueScoringJob(task,{id:crypto.randomUUID(),candidateId:person.id,action:input.action,status:'queued',queuedAt:new Date().toISOString()});action=input.action==='reassess'?'已按暂估分新规则重新提交综合评估':'已提交后台综合评估';
      } else if (input.action === 'review') {
        try { validateReview(person, input); } catch(e) { throw new WorkflowError((e as Error).message); }
        person.review = { scores: input.scores, reason: input.reason, conflictNote: input.conflictNote, decision: input.decision, confirmedAt: new Date().toISOString() };
        action = '招聘负责人确认评估并记录处理意见';
      }
      }
    }
    const updated = await saveTask(task, version, owner, action, 'candidateId' in input ? input.candidateId : person?.id);
    const submittedScoring=['screen','rescreen','assess','reassess'].includes(input.action);
    return NextResponse.json(publicTaskRecord(updated),{status:submittedScoring?202:200});
  } catch(e) { return failure(e); }
}
export async function DELETE(request:Request,ctx:{params:Promise<{id:string}>}){
 try{
  const owner=await requireOwner();const id=z.uuid().parse((await ctx.params).id);
  const {version}=z.object({version:z.number().int().positive()}).parse(await request.json());
  const row=await loadTask(id,owner);const task=archiveTask(row.data);
  task.audit.push({at:task.archivedAt!,action:task.purgeAfter?`归档任务，将于 ${new Date(task.purgeAfter).toLocaleDateString('zh-CN')} 后永久删除`:'归档任务，可随时恢复'});
  const result=await getPool().query('UPDATE hiring_tasks SET data=$1::jsonb,version=version+1,updated_at=now() WHERE id=$2 AND owner_email=$3 AND version=$4 RETURNING id',[JSON.stringify(task),id,owner,version]);
  if(!result.rowCount)throw new WorkflowError('任务刚有更新，请刷新后再删除。',409);
  return NextResponse.json({ok:true});
 }catch(e){return failure(e);}
}
export async function PATCH(request:Request,ctx:{params:Promise<{id:string}>}){
 try{
  const owner=await requireOwner();const id=z.uuid().parse((await ctx.params).id);
  const {version}=z.object({version:z.number().int().positive()}).parse(await request.json());
  const row=await loadTask(id,owner,true);if(!taskIsArchived(row.data))throw new WorkflowError('任务未归档。',409);
  const task=restoreTask(row.data);task.audit.push({at:new Date().toISOString(),action:'恢复已归档任务'});
  const result=await getPool().query('UPDATE hiring_tasks SET data=$1::jsonb,version=version+1,updated_at=now() WHERE id=$2 AND owner_email=$3 AND version=$4 RETURNING id',[JSON.stringify(task),id,owner,version]);
  if(!result.rowCount)throw new WorkflowError('任务刚有更新，请刷新后重试。',409);
  return NextResponse.json({ok:true});
 }catch(e){return failure(e);}
}
