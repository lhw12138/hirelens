import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {getPool} from '../src/server/db/client';
import {processScoringJob} from '../src/server/workflow/scoring-worker';
import {assessPerson} from '../src/server/workflow/model';
const id='b831b640-1119-473c-a4b0-0bb9ee810020';
const db=getPool();const result=await db.query('SELECT data FROM hiring_tasks WHERE id=$1',[id]);
assert.equal(result.rows[0]?.data.synthetic,true);assert.equal(result.rows[0]?.data.title,'后台评分与删除验收（合成）');
const require=createRequire(import.meta.url);const {chromium}=require('C:/Users/lhw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000}});const base='http://localhost:3000';
 const login=await context.request.post(base+'/api/auth/login',{data:{email:process.env.HR_ADMIN_EMAIL||'admin@hirelens.local',password:process.env.HR_ADMIN_PASSWORD||'hirelens-demo'}});assert.equal(login.status(),200);
 const page=await context.newPage();await page.goto(base+'/tasks/'+id);await page.getByRole('button',{name:'评分简历',exact:true}).click();await page.getByText('等待后台评分',{exact:false}).waitFor();
 await page.goto(base+'/guide');
 // Only this known synthetic test task. Never process user tasks here.
 const work=processScoringJob(assessPerson,id);
 await page.goto(base+'/');await page.getByText('后台评分中',{exact:false}).first().waitFor({timeout:10000});
 await page.screenshot({path:'.impeccable/review/background-desktop.png',fullPage:true});
 await work;
 const saved=await(await context.request.get(base+'/api/tasks/'+id)).json();assert.equal(saved.data.scoringJob.status,'succeeded',saved.data.scoringJob.error);assert.ok(saved.data.candidates[0].screening);
 await page.goto(base+'/tasks/'+id);await page.getByText('评分已完成',{exact:false}).waitFor();
 await page.goto(base+'/');page.once('dialog',(d:{accept:()=>Promise<void>})=>d.accept());await page.getByRole('button',{name:'删除任务：后台评分与删除验收（合成）',exact:true}).click();await page.getByText('已移入已删除任务，可随时恢复。',{exact:true}).waitFor();
 await page.getByRole('button',{name:'查看已删除',exact:true}).click();await page.getByRole('button',{name:'恢复任务：后台评分与删除验收（合成）',exact:true}).click();await page.getByText('任务已恢复；被取消的评分需要重新提交。',{exact:true}).waitFor();
 await page.getByRole('button',{name:'返回继续工作',exact:true}).click();await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'删除任务：后台评分与删除验收（合成）',exact:true}).waitFor();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 await page.screenshot({path:'.impeccable/review/background-mobile.png',fullPage:true});
 console.log('PASS real synthetic scoring after navigation, saved result, delete confirmation, restore, mobile overflow');
}finally{await browser.close();await db.end();}
