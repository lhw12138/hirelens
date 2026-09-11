import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require=createRequire(import.meta.url);
const { chromium }=require("C:/Users/lhw/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright");
const base=process.env.HIRELENS_TEST_URL||"http://localhost:3000";
const browser=await chromium.launch({channel:"msedge",headless:true});
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  const login=await context.request.post(base+"/api/auth/login",{data:{email:process.env.HR_ADMIN_EMAIL||"admin@hirelens.local",password:process.env.HR_ADMIN_PASSWORD||"hirelens-demo"}});
  assert.equal(login.status(),200,"test login failed");
  const health=await context.request.get(base+"/api/health");assert.equal(health.status(),200);const payload=await health.json();
  assert.equal(payload.services.length,7);assert.ok(payload.services.some(service=>service.id==="scoring-worker"&&service.state==="ok"));assert.ok(payload.services.some(service=>service.id==="evaluation-worker"&&service.state==="ok"));
  const page=await context.newPage();await page.goto(base+"/health",{waitUntil:"networkidle"});await page.getByRole("heading",{name:"系统状态"}).waitFor();await page.locator(".hl-health-list article").first().waitFor();
  assert.equal(await page.locator(".hl-health-list article").count(),7);assert.ok(await page.getByRole("link",{name:"系统状态",exact:true}).getAttribute("aria-current"));
  await page.screenshot({path:".impeccable/review/system-health-desktop.png",fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:"networkidle"});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,"mobile horizontal overflow");
  await page.screenshot({path:".impeccable/review/system-health-mobile.png",fullPage:true});
  console.info(JSON.stringify({state:payload.state,services:payload.services.map(service=>({id:service.id,state:service.state}))}));
}finally{await browser.close();}
