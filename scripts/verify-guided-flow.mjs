
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { mkdir, writeFile } from 'node:fs/promises';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.HIRELENS_PLAYWRIGHT_PATH || 'playwright');
const base = process.env.HIRELENS_TEST_URL || 'http://localhost:3000';
const browser = await chromium.launch({channel:'msedge',headless:true});
const context = await browser.newContext({viewport:{width:1440,height:1000}});
const page = await context.newPage();
const errors=[];
page.on('pageerror', e=>errors.push(e.message));
const report = [];
const out='.impeccable/review';
await mkdir(out,{recursive:true});
let taskId;
try {
  await page.goto(base+'/login');
  await page.getByRole('textbox',{name:'邮箱'}).fill(process.env.HR_ADMIN_EMAIL||'admin@hirelens.local');
  await page.getByLabel('密码',{exact:true}).fill(process.env.HR_ADMIN_PASSWORD||'hirelens-demo');
  await page.getByRole('button',{name:'进入工作台'}).click();
  await page.waitForURL(base+'/');
  if(process.env.HIRELENS_RESUME_TASK){taskId=process.env.HIRELENS_RESUME_TASK;}else{
  await page.getByRole('button',{name:'用示例开始体验'}).click();
  await page.waitForURL('**/tasks/*');
  taskId=page.url().split('/').at(-1);
  await page.getByRole('button',{name:'确认要求，下一步'}).click();
  await page.getByRole('button',{name:'添加两份示例用于比较'}).click();
  await page.getByText('我已检查并删除姓名').waitFor();
  await page.getByText('我已检查并删除姓名').click();
  await page.getByRole('button',{name:'确认资料，下一步'}).click();
  }
  const api=context.request;
  let row=await (await api.get(base+'/api/tasks/'+taskId)).json();
  const post=async(input,expected=200)=>{
    const response=await api.post(base+'/api/tasks/'+taskId,{data:{...input,version:row.version},timeout:180000});
    let d=await response.json();
    assert.equal(response.status(),expected===200&&['screen','rescreen','assess'].includes(input.action)?202:expected,JSON.stringify(d));
    if(response.status()===202){const deadline=Date.now()+240000;while(['queued','running'].includes(d.data.scoringJob.status)&&Date.now()<deadline){await new Promise(r=>setTimeout(r,1500));d=await(await api.get(base+'/api/tasks/'+taskId)).json();}assert.equal(d.data.scoringJob.status,'succeeded','后台评分失败或超时；检查 scoring:worker');}
    if(response.ok())row=d;
    return d;
  };
  const ids=row.data.candidates.map(p=>p.id);
  if(!row.data.candidates[0].shortlisted)await post({action:'record',candidateId:ids[0],text:'这是一段尚未完成筛选的合成面试记录，应该被服务器拒绝。',complete:true},400);
  if(!row.data.candidates[0].resumeConfirmed)await post({action:'resume',candidateId:ids[0],resume:row.data.candidates[0].resume});
  console.log('PASS onboarding, batch import, redaction confirmation, shortlist gate');
  // Score both actual resumes through the configured model, with one explicit retry only.
  for(const id of ids){
    if(row.data.candidates.find(p=>p.id===id).screening)continue;
    try { await post({action:'screen',candidateId:id}); }
    catch{ console.log('Retrying one failed model screening'); await post({action:'screen',candidateId:id}); }
    console.log('PASS live resume screening '+(ids.indexOf(id)+1));
  }
  const beforeShortlistVersion=row.version;
  await post({action:'shortlist',candidateId:ids[0]});
  const stale=await api.post(base+'/api/tasks/'+taskId,{data:{action:'invite',candidateId:ids[0],version:beforeShortlistVersion}});
  assert.equal(stale.status(),409);
  await page.goto(base+'/tasks/'+taskId+'?candidate='+ids[0]);
  await page.getByRole('heading',{name:'面试结束后，把记录放在这里'}).waitFor();
  await page.getByRole('button',{name:'填入示例面试记录'}).click();
  await page.getByText('我已检查记录内容').click();
  await page.getByRole('button',{name:'确认记录，下一步'}).click();
  await page.getByRole('heading',{name:'资料齐了，生成一份有依据的评估。'}).waitFor();
  row=await (await api.get(base+'/api/tasks/'+taskId)).json();
  const criteria=row.data.criteria.map((c,i)=>({...c,name:i===0?'综合业务判断':c.name}));
  await post({action:'rubric',criteria});
  assert.notEqual(row.data.criteria[0].name,row.data.evaluationCriteria[0].name);
  console.log('PASS uploaded-record flow, separate final rubric, version conflict');
  try {await post({action:'assess',candidateId:ids[0]});}
  catch{console.log('Retrying one failed combined assessment');await post({action:'assess',candidateId:ids[0]});}
  const person=row.data.candidates[0];
  assert.ok(person.assessment);
  const citations=person.assessment.scores.flatMap(s=>s.sourceIds);
  assert.ok(citations.length>0);
  assert.ok(citations.every(id=>person.sources.some(s=>s.id===id)));
  assert.ok(person.sources.some(s=>s.kind==='answer'));
  const scores=Object.fromEntries(person.assessment.scores.map(s=>[s.criterionId,s.score]));
  if(person.assessment.conflicts.length) await post({action:'review',candidateId:person.id,scores,reason:'合成验收核对原文',conflictNote:'',decision:'hold'},400);
  await page.reload();
  await page.getByRole('heading',{name:'核对原文，形成你的判断'}).waitFor();
  await page.screenshot({path:out+'/review-desktop.png',fullPage:true});
  await page.getByLabel('审核意见 / 修改分数的依据').fill('合成验收：已核对引用，需补充项目起止时间后再判断。');
  const conflict=page.getByLabel('核实记录',{exact:true});
  if(await conflict.count())await conflict.fill('合成验收：目前尚未核实时间差异，暂缓推进。');
  await page.getByText('我已核对评分与引用').click();
  await page.getByRole('button',{name:'确认并保存评估'}).click();
  await page.getByRole('heading',{name:'评估已确认，判断依据已留存'}).waitFor();
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'导出评估记录'}).click();
  const download=await downloadPromise;
  assert.ok(download.suggestedFilename().endsWith('.md'));
  await page.reload();
  await page.getByRole('heading',{name:'评估已确认，判断依据已留存'}).waitFor();
  console.log('PASS combined model, human review, export, refresh persistence');
  row=await (await api.get(base+'/api/tasks/'+taskId)).json();
  await post({action:'review',candidateId:ids[0],scores,reason:'不应覆盖已确认结果',conflictNote:'合成验收不覆盖历史',decision:'hold'},409);
  await post({action:'shortlist',candidateId:ids[1]});
  const invited=await post({action:'invite',candidateId:ids[1]});
  const token=invited.invitationToken;
  const guest=await browser.newContext();
  const other=await browser.newContext();
  const g=guest.request;
  assert.equal((await g.get(base+'/api/tasks')).status(),401);
  const publicData=await (await g.get(base+'/api/respond/'+token)).json();
  assert.ok(!('resume' in publicData));
  assert.equal((await g.post(base+'/api/respond/'+token,{data:{}})).status(),200);
  assert.equal((await other.request.post(base+'/api/respond/'+token,{data:{}})).status(),403);
  const answers=Object.fromEntries(publicData.questions.map(q=>[q.id,'【合成回答】负责需求讨论和上线验证，具体业务数据待核实。']));
  assert.equal((await g.post(base+'/api/respond/'+token,{data:{answers,complete:true}})).status(),200);
  assert.equal((await g.post(base+'/api/respond/'+token,{data:{answers,complete:true}})).status(),200);
  await guest.close();await other.close();
  console.log('PASS candidate link privacy, one-browser binding, idempotent submission');
  await page.goto(base+'/tasks/'+taskId);
  await page.getByRole('button',{name:'筛选简历',exact:false}).click();
  await page.getByRole('heading',{name:'先筛简历，再选择面试人选'}).waitFor();
  await page.screenshot({path:out+'/screening-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:out+'/screening-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'screening horizontal overflow');
  await page.goto(base+'/');
  await page.getByRole('heading',{name:'从一份 JD，开始招聘评估。'}).waitFor();
  await page.locator('.hl-task-row').first().waitFor();
  await page.screenshot({path:out+'/mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'home horizontal overflow');
  await page.setViewportSize({width:1440,height:1000});
  await page.screenshot({path:out+'/desktop.png',fullPage:true});
  assert.deepEqual(errors,[]);
  report.push({status:'passed',taskId,checks:['onboarding','batch','redaction','screening','separate rubrics','records','combined assessment','review','export','reload','authorization','candidate isolation','responsive'],model:person.assessment.model});
  await writeFile(out+'/workflow-verification.json',JSON.stringify(report,null,2));
  console.log('ALL PASSED task '+taskId);
} catch(e) {
  await page.screenshot({path:out+'/failure.png',fullPage:true}).catch(()=>{});
  console.error(String(e));
  process.exitCode=1;
} finally {await browser.close();}
