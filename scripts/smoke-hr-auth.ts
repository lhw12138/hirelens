import assert from 'node:assert/strict';
import {POST as authenticate} from '@/app/api/auth/login/route';
import {verifyHrSession} from '@/lib/session';
import type {HiringTask} from '@/lib/workflow';
import {getDatabase,getPool} from '@/server/db/client';
import {hiringTasks} from '@/server/db/schema';
import {listTasks} from '@/server/workflow/store';

const suffix=crypto.randomUUID().slice(0,8);
const emails=[`hr-smoke-a-${suffix}@example.test`,`hr-smoke-b-${suffix}@example.test`];
const taskIds=[crypto.randomUUID(),crypto.randomUUID()];

async function register(email:string){
 const response=await authenticate(new Request('http://localhost/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'register',email,password:'Smoke2026'})}));
 assert.equal(response.status,200,`注册失败：${response.status} ${await response.text()}`);
 const token=response.headers.get('set-cookie')?.match(/hirelens_session=([^;]+)/)?.[1];
 assert.ok(token,'注册响应没有会话 Cookie');
 const session=await verifyHrSession(token);
 assert.equal(session?.email,email,'会话没有绑定到注册账号');
 return session!;
}

try{
 const [first,second]=await Promise.all(emails.map(register));
 assert.notEqual(first.id,second.id,'两个 HR 错误地共享了账号 ID');
 const tasks:HiringTask[]=taskIds.map((id,index)=>({id,title:`隔离测试 ${index+1}`,jd:'用于验证账号隔离的测试岗位描述。',criteria:[],synthetic:true,confirmed:false,candidates:[],audit:[]}));
 await getDatabase().insert(hiringTasks).values(tasks.map((data,index)=>({id:data.id,ownerEmail:emails[index],data})));
 const [firstTasks,secondTasks]=await Promise.all(emails.map(email=>listTasks(email)));
 assert.deepEqual(firstTasks.map(row=>row.id),[taskIds[0]],'账号 A 看到了其他账号的任务');
 assert.deepEqual(secondTasks.map(row=>row.id),[taskIds[1]],'账号 B 看到了其他账号的任务');
 console.log(JSON.stringify({status:'passed',accounts:2,isolatedWorkspaces:2}));
}finally{
 await getPool().query('DELETE FROM hiring_tasks WHERE id=ANY($1::uuid[])',[taskIds]);
 await getPool().query('DELETE FROM hr_accounts WHERE email=ANY($1::text[])',[emails]);
 await getPool().end();
}
