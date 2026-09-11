import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir} from "node:fs/promises";
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.HIRELENS_PLAYWRIGHT_PATH||"playwright");
const base=process.env.HIRELENS_TEST_URL||"http://localhost:3000";
const expectedPromptVersion="evidence-judge-v3.0";
const browser=await chromium.launch({channel:"msedge",headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage(),errors=[];
page.on("pageerror",error=>errors.push(error.message));
await mkdir(".impeccable/review",{recursive:true});
try{
 await page.goto(base+"/login");
 await page.getByRole("textbox",{name:"邮箱"}).fill(process.env.HR_ADMIN_EMAIL||"admin@hirelens.local");
 await page.getByLabel("密码",{exact:true}).fill(process.env.HR_ADMIN_PASSWORD||"hirelens-demo");
 await page.getByRole("button",{name:"进入工作台"}).click();
 await page.waitForURL(base+"/");
 await page.goto(base+"/evals");
 await page.getByRole("heading",{name:"先证明结论可靠，再交给 HR 使用"}).waitFor();
 const blindResponse=await context.request.get(base+"/api/evals/blind-review");
 assert.equal(blindResponse.status(),200);
 const blind=await blindResponse.json();
 if(blind.session?.status==="in_progress"){
  assert.equal(blind.session.cases.some(item=>"expected" in item||"scenario" in item||"title" in item),false,"进行中的盲审泄露了设计标注");
  assert.equal("aiResults" in blind.session,false,"进行中的盲审泄露了AI结果");
 }
 await page.getByRole("button",{name:/开始个人盲审|保存并下一条|开始新一轮/}).first().waitFor();
 const dataset=await (await context.request.get(base+"/api/evals/run")).json();
 assert.equal(dataset.dataset.cases.length,dataset.dataset.totalCases);
 const sample=dataset.dataset.cases[0];
 const invalid=await context.request.patch(base+`/api/evals/cases/${sample.id}`,{data:{status:"insufficient",scoreRange:[20,30],requiredSourceIds:sample.expected.requiredSourceIds,forbiddenSourceIds:sample.expected.forbiddenSourceIds,rationale:sample.expected.rationale,reviewNote:"自动校验输入规则"}});
 assert.equal(invalid.status(),400);
 const initial=await context.request.get(base+"/api/evals/run");
 assert.equal(initial.status(),200);
 let payload=await initial.json();
 const hasCompleted=payload.runs.some(run=>run.status==="completed"&&run.promptVersion===expectedPromptVersion);
 const start=hasCompleted?null:await context.request.post(base+"/api/evals/run");
 if(start){assert.ok([200,202].includes(start.status()));payload=await start.json();}
 const deadline=Date.now()+240000;
 while(payload.runs[0]&&["queued","running"].includes(payload.runs[0].status)&&Date.now()<deadline){await new Promise(resolve=>setTimeout(resolve,1800));payload=await(await context.request.get(base+"/api/evals/run")).json();}
 assert.equal(payload.runs[0]?.status,"completed","新版后台评测未在时限内完成");
 assert.equal(payload.runs[0]?.promptVersion,expectedPromptVersion);
 assert.equal(payload.runs[0]?.metrics?.completedCases,payload.dataset.totalCases);
 await page.reload();
 await page.getByRole("heading",{name:"质量门槛"}).waitFor();
 if(payload.runs.filter(run=>run.status==="completed").length>1)await page.getByRole("heading",{name:"与上一次运行相比"}).waitFor();
 await page.screenshot({path:".impeccable/review/evaluation-desktop.png",fullPage:true});
 const firstFailure=page.locator(".hl-eval-failures details").first();
 if(await firstFailure.count()){
  await firstFailure.locator("summary").click();
  await firstFailure.getByRole("button",{name:"校准设计标注"}).click();
  await page.getByRole("button",{name:"保存 HR 标注"}).waitFor();
 }
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:".impeccable/review/evaluation-mobile.png",fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth);
 assert.equal(overflow,false);
 assert.deepEqual(errors,[]);
 console.log(JSON.stringify({status:"PASS",promptVersion:payload.runs[0].promptVersion,metrics:{statusAccuracy:payload.runs[0].metrics.statusAccuracy,citationAccuracy:payload.runs[0].metrics.citationAccuracy,evidenceCoverage:payload.runs[0].metrics.evidenceCoverage,unsupportedConclusionRate:payload.runs[0].metrics.unsupportedConclusionRate,conflictRecall:payload.runs[0].metrics.conflictRecall,scoreRangeAccuracy:payload.runs[0].metrics.scoreRangeAccuracy},screenshots:[".impeccable/review/evaluation-desktop.png",".impeccable/review/evaluation-mobile.png"]},null,2));
}finally{await browser.close();}
