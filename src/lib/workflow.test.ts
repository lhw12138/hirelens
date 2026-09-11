import { describe, expect, it } from 'vitest';
import { currentStep, screeningValue, defaultCriteria, sampleCriteria, validateCriteria, validateAssessment, validateReview, type HiringTask, type Person } from './workflow';
const task: HiringTask = {id:'t',title:'test',jd:'jd',confirmed:true,synthetic:true,criteria:sampleCriteria,candidates:[],audit:[]};
const person: Person = {id:'p',name:'合成',synthetic:true,filename:'demo',resume:'text',resumeConfirmed:true,sources:[],questions:[],answers:{},interviewComplete:false};
const sources = [{id:'r1',kind:'resume' as const,locator:'段落1',text:'简历证据'}, {id:'a1',kind:'answer' as const,locator:'面试1',text:'回答证据'}];
const draft = () => ({summary:'候选人的证据尚需招聘负责人进一步核对。',scores:sampleCriteria.map(c=>({criterionId:c.id,score:80,claim:'具体经历',sourceIds:['r1'],status:'supported'})),conflicts:[]});
describe('guided hiring lifecycle',()=>{
  it('requires resume screening and a human shortlist before interview',()=>{
    expect(currentStep(task,person)).toBe(1);
    expect(currentStep(task,{...person,shortlisted:true})).toBe(2);
    expect(currentStep(task,{...person,shortlisted:true,interviewComplete:true})).toBe(3);
    expect(currentStep({...task,confirmed:false},person)).toBe(0);
  });
  it('requires weights sum to 100 and unique dimensions',()=>{
    expect(()=>validateCriteria(defaultCriteria)).not.toThrow();
    expect(()=>validateCriteria(sampleCriteria)).not.toThrow();
    expect(()=>validateCriteria(sampleCriteria.map(c=>({...c,weight:20})))).toThrow();
    expect(()=>validateCriteria(sampleCriteria.map(c=>({...c,id:'same'})))).toThrow();
  });
  it('does not rank missing evidence as zero ability',()=>{
    const screening={...validateAssessment(draft(),sampleCriteria,sources),model:'test',latencyMs:1,inputTokens:1,outputTokens:1,createdAt:'now'};
    expect(screeningValue({...person,screening},sampleCriteria)).toBe(80);
    screening.scores=screening.scores.map(s=>({...s,score:null,status:'insufficient'}));
    expect(screeningValue({...person,screening},sampleCriteria)).toBeNull();
    screening.scores[0]={...screening.scores[0],score:0,status:'supported'};
    expect(screeningValue({...person,screening},sampleCriteria)).toBeNull();
    screening.scores=screening.scores.map(s=>({...s,score:0,status:'supported'}));
    expect(screeningValue({...person,screening},sampleCriteria)).toBe(0);
  });
  it('keeps evidence-based low job fit numeric only in screening',()=>{
    const d=draft();d.scores=d.scores.map(s=>({...s,score:15,status:'low_match',claim:'已检索材料为通信研究和软件开发，未体现财务流程应用。'}));
    expect(validateAssessment(d,sampleCriteria,sources,'screening').scores[0].score).toBe(15);
    expect(()=>validateAssessment(d,sampleCriteria,sources,'combined')).toThrow();
    d.scores[0].sourceIds=[];
    expect(()=>validateAssessment(d,sampleCriteria,sources,'screening')).toThrow();
  });
  it('accepts transferable experience and rejects contradictory score bands',()=>{
    const d=draft();d.scores=d.scores.map(s=>({...s,score:35,status:'partial_match'}));
    expect(validateAssessment(d,sampleCriteria,sources,'screening').scores[0].score).toBe(35);
    d.scores[0].score=90;
    expect(()=>validateAssessment(d,sampleCriteria,sources,'screening')).toThrow();
  });
  it('rejects citations from another candidate and missing dimensions',()=>{
    const d=draft();d.scores[0].sourceIds=['foreign-id'];
    expect(()=>validateAssessment(d,sampleCriteria,sources)).toThrow();
    expect(()=>validateAssessment({...draft(),scores:[]},sampleCriteria,sources)).toThrow();
  });
  it('keeps a low-confidence numeric estimate for insufficient combined evidence',()=>{
    const d=draft();d.scores[0]={...d.scores[0],sourceIds:[],status:'insufficient',score:8,claim:'当前材料没有可核验的项目行动，仅表示材料匹配度。'};
    expect(validateAssessment(d,sampleCriteria,sources).scores[0].score).toBe(8);
    d.scores[0].score=30;
    expect(()=>validateAssessment(d,sampleCriteria,sources)).toThrow();
  });
  it('requires two different cited sources for conflicts',()=>{
    const d={...draft(),conflicts:[{topic:'日期',description:'不一致',sourceIds:['r1','r1']}]};
    expect(()=>validateAssessment(d,sampleCriteria,sources)).toThrow();
  });
  it('retains AI original while validating complete human revisions',()=>{
    const a={...validateAssessment(draft(),sampleCriteria,sources),model:'test',latencyMs:1,inputTokens:1,outputTokens:1,createdAt:new Date().toISOString()};
    const p={...person,assessment:a};const review={scores:Object.fromEntries(sampleCriteria.map(c=>[c.id,85])),reason:'原文已经逐项核实',conflictNote:'',decision:'hold' as const};
    expect(()=>validateReview(p,review)).not.toThrow();
    expect(a.scores[0].score).toBe(80);
    expect(()=>validateReview(p,{...review,scores:{}})).toThrow();
    expect(()=>validateReview({...p,review:{...review,confirmedAt:'now'}},review)).toThrow();
  });
  it('requires explicit conflict notes before confirmation',()=>{
    const a={...validateAssessment({...draft(),conflicts:[{topic:'时间',description:'待核实',sourceIds:['r1','a1']}]},sampleCriteria,sources),model:'test',latencyMs:1,inputTokens:1,outputTokens:1,createdAt:'now'};
    expect(()=>validateReview({...person,assessment:a},{scores:Object.fromEntries(sampleCriteria.map(c=>[c.id,80])),reason:'已审核原文',conflictNote:'',decision:'hold'})).toThrow();
  });
});
