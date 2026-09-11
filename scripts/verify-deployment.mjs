import assert from "node:assert/strict";
const base=(process.env.HIRELENS_BASE_URL||"").replace(/\/$/,"");
assert.ok(base.startsWith("https://")||base.startsWith("http://localhost"),"Set HIRELENS_BASE_URL to the SAE HTTPS URL");
const live=await fetch(base+"/api/live",{signal:AbortSignal.timeout(10_000)});assert.equal(live.status,200);const body=await live.json();assert.equal(body.status,"ok");
const landing=await fetch(base,{redirect:"manual",signal:AbortSignal.timeout(10_000)});assert.ok([200,301,302,303,307,308].includes(landing.status));
console.info(JSON.stringify({base,live:body.status,landingStatus:landing.status}));
