import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdir } from "node:fs/promises";
import pg from "pg";

const require=createRequire(import.meta.url),{chromium}=require(process.env.HIRELENS_PLAYWRIGHT_PATH||"playwright"),base=process.env.HIRELENS_TEST_URL||"http://localhost:3000";
const browser=await chromium.launch({channel:"msedge",headless:true}),context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
await mkdir(".impeccable/review",{recursive:true});
let createdId="";
try{
 await page.goto(base+"/login");
 await page.getByRole("textbox",{name:"邮箱"}).fill(process.env.HR_ADMIN_EMAIL||"admin@hirelens.local");
 await page.getByLabel("密码",{exact:true}).fill(process.env.HR_ADMIN_PASSWORD||"hirelens-demo");
 await page.getByRole("button",{name:"进入工作台"}).click();
 await page.waitForURL(base+"/");
 await context.request.get(base+"/api/evals/blind-review");
 const started=await context.request.post(base+"/api/evals/blind-review"),active=await started.json();
 assert.equal(started.status(),201,"当前数据集已有未完成的正式盲审，自动验收已停止且不会覆盖它");createdId=active.session.id;
 assert.equal(active.session.status,"in_progress");assert.equal(active.session.total,20);assert.equal(active.session.cases.length,20);
 assert.equal(active.session.cases.some(item=>"expected" in item||"scenario" in item||"title" in item),false);assert.equal("aiResults" in active.session,false);
 await page.goto(base+"/evals");await page.getByRole("heading",{name:"只看原文，先做自己的判断"}).waitFor();
 assert.equal(await page.getByRole("heading",{name:"质量门槛"}).count(),0,"盲审期间仍显示了AI结果");
 await page.screenshot({path:".impeccable/review/blind-review-desktop.png",fullPage:true});
 for(const item of active.session.cases){const sources=item.sources||[],status=sources.length>1?"conflict":sources.length===1?"supported":"insufficient",sourceIds=status==="conflict"?sources.slice(0,2).map(source=>source.id):status==="supported"?[sources[0].id]:[];const saved=await context.request.patch(base+"/api/evals/blind-review",{data:{action:"save",sessionId:createdId,caseId:item.id,status,score:status==="conflict"?null:status==="insufficient"?0:50,sourceIds,reason:"自动流程验收记录"}});assert.equal(saved.status(),200);}
 const completed=await context.request.patch(base+"/api/evals/blind-review",{data:{action:"complete",sessionId:createdId}}),report=await completed.json();
 assert.equal(completed.status(),200);assert.equal(report.session.status,"completed");assert.equal(report.session.report.comparedCases,20);assert.ok("statusAgreement" in report.session.report);assert.ok("citationAgreement" in report.session.report);
 await page.reload();await page.getByRole("heading",{name:"个人盲审已完成"}).waitFor();
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:".impeccable/review/blind-review-mobile.png",fullPage:true});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:"PASS",cases:20,report:report.session.report,screenshots:[".impeccable/review/blind-review-desktop.png",".impeccable/review/blind-review-mobile.png"]},null,2));
}finally{
 await browser.close();
 if(createdId){const pool=new pg.Pool({connectionString:process.env.DATABASE_URL});try{await pool.query("DELETE FROM blind_review_sessions WHERE id=$1",[createdId]);}finally{await pool.end();}}
}
