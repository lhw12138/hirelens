import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.HIRELENS_PLAYWRIGHT_PATH||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
const base='http://localhost:3000';
try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const api=context.request;
 assert.equal((await api.post(base+'/api/auth/login',{data:{email:process.env.HR_ADMIN_EMAIL||'admin@hirelens.local',password:process.env.HR_ADMIN_PASSWORD||'hirelens-demo'}})).status(),200);
 let row=await (await api.post(base+'/api/tasks',{data:{synthetic:true}})).json();
 const post=async(data,status=200)=>{const r=await api.post(base+'/api/tasks/'+row.id,{data:{...data,version:row.version},timeout:180000});const result=await r.json();assert.equal(r.status(),status,JSON.stringify(result));if(r.ok())row=result;return result;};
 await post({action:'job',title:'初筛规则验证 · 合成资料',jd:row.data.jd,criteria:row.data.criteria,confirm:true});
 const resumes=[
  ['低匹配样本','【合成简历】通信实验室研究：负责光纤器件原理调研，对比插入损耗与串扰指标。软件项目：使用Java和Redis实现点餐网站后端，开发购物车、下单、缓存与运营报表。机器学习项目：使用PyTorch做卫星图像洪水分割，未提供模型选型或评测方法。小游戏项目：使用pygame开发贪吃蛇。'],
  ['相关经历样本','【合成简历】财务共享项目：访谈财务、IT、业务负责人，梳理报销对账流程，发现人工核对附件的问题。编写PRD和验收标准，按风险与频率先交付异常单据定位，再做辅助解释。比较关键词与语义检索，建立固定测试问题，逐条人工检查引用、无依据结论，记录耗时和用量。协调财务与研发完成灰度上线，记录误报、缺陷和修订方案，审批由人工确认。'],
  ['资料缺失样本','【合成资料缺失测试】仅上传个人信息封面，学历为硕士。工作经历、专业技能和项目内容所在正文页尚未上传。当前文件并非完整简历，需要补齐正文。'],
 ];
 for(const [name,resume] of resumes){await post({action:'candidate',name,resume,filename:'synthetic.txt',synthetic:true});const p=row.data.candidates.at(-1);await post({action:'resume',candidateId:p.id,resume:p.resume});await post({action:'screen',candidateId:p.id});console.log(JSON.stringify({sample:name,scores:row.data.candidates.at(-1).screening.scores.map(s=>({score:s.score,status:s.status}))}));}
 const [low,strong,missing]=row.data.candidates;
 const total=p=>p.screening.scores.reduce((n,s)=>n+s.score*row.data.criteria.find(c=>c.id===s.criterionId).weight/100,0);
 assert.ok(low.screening.scores.every(s=>s.score!==null));assert.ok(total(low)<50);
 assert.ok(strong.screening.scores.every(s=>s.score!==null));assert.ok(total(strong)>total(low));
 assert.ok(missing.screening.scores.every(s=>s.score===null));
 await post({action:'rescreen',candidateId:low.id},409);
 const page=await context.newPage();await page.goto(base+'/tasks/'+row.id);await page.getByRole('heading',{name:'先筛简历，再选择面试人选'}).waitFor();
 await page.screenshot({path:'.impeccable/review/scoring-policy-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'.impeccable/review/scoring-policy-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 console.log('PASS low fit, stronger fit, missing material, duplicate rescore rejection, desktop/mobile. Task '+row.id);
}finally{await browser.close();}
