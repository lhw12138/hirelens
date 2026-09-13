import {createHash} from 'node:crypto';
import {compare, hash} from 'bcryptjs';
import {eq} from 'drizzle-orm';
import {NextResponse} from 'next/server';
import {z} from 'zod';
import {allowAttempt} from '@/lib/attempt-limit';
import {hrCredentials} from '@/lib/hr-auth';
import {accountPasswordError} from '@/lib/password-policy';
import {createHrSession} from '@/lib/session';
import {getDatabase} from '@/server/db/client';
import {hrAccounts} from '@/server/db/schema';
import {WorkflowError} from '@/server/workflow/store';

const dummyHash = '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';

async function requestBody(request: Request) {
 const text=await request.text();
 if(text.length>10_000)throw new WorkflowError('请求内容过长。',413);
 try{return JSON.parse(text);}catch{throw new WorkflowError('请求格式不正确。');}
}

export async function POST(request: Request) {
 try {
  const data=hrCredentials.parse(await requestBody(request));
  const emailKey=createHash('sha256').update(data.email).digest('hex');
  if(!allowAttempt('hr-auth:global',150)||!allowAttempt(`hr-auth:${emailKey}`))throw new WorkflowError('尝试次数较多，请15分钟后再试。',429);
  if(data.action==='register'&&!allowAttempt('hr-auth:register-global',30))throw new WorkflowError('当前注册较多，请15分钟后再试。',429);
  if(Buffer.byteLength(data.password)>72)throw new WorkflowError('密码最多72字节，请缩短后重试。');
  const configuredEmail=process.env.HR_ADMIN_EMAIL?.trim().toLowerCase();
  const configuredPassword=process.env.HR_ADMIN_PASSWORD;
  const db=getDatabase();
  let account:{id:string;email:string;passwordHash:string}|undefined;
  if(data.action==='register'){
   if(configuredEmail&&data.email===configuredEmail)throw new WorkflowError('该管理员账号已经配置，请直接登录。',409);
   [account]=await db.insert(hrAccounts).values({email:data.email,passwordHash:await hash(data.password,12)}).onConflictDoNothing().returning({id:hrAccounts.id,email:hrAccounts.email,passwordHash:hrAccounts.passwordHash});
   if(!account)throw new WorkflowError('无法创建账号；若已注册，请使用登录。',409);
  }else{
   [account]=await db.select({id:hrAccounts.id,email:hrAccounts.email,passwordHash:hrAccounts.passwordHash}).from(hrAccounts).where(eq(hrAccounts.email,data.email));
   const legacyMatch=!account&&configuredEmail===data.email&&configuredPassword===data.password;
   if(legacyMatch){
    if(accountPasswordError(configuredPassword!))throw new WorkflowError('管理员密码不符合当前规则，请更新服务器配置。',503);
    [account]=await db.insert(hrAccounts).values({email:data.email,passwordHash:await hash(data.password,12)}).onConflictDoNothing().returning({id:hrAccounts.id,email:hrAccounts.email,passwordHash:hrAccounts.passwordHash});
    if(!account)[account]=await db.select({id:hrAccounts.id,email:hrAccounts.email,passwordHash:hrAccounts.passwordHash}).from(hrAccounts).where(eq(hrAccounts.email,data.email));
   }
   const valid=await compare(data.password,account?.passwordHash??dummyHash);
   if(!account||!valid)throw new WorkflowError('邮箱或密码不正确。',401);
  }
  const response=NextResponse.json({ok:true});
  response.cookies.set('hirelens_session',await createHrSession(account.id,account.email),{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:8*3600});
  return response;
 }catch(error){
  if(error instanceof WorkflowError)return NextResponse.json({error:error.message},{status:error.status});
  if(error instanceof z.ZodError)return NextResponse.json({error:'请检查邮箱格式和密码规则。'},{status:400});
  const incident=crypto.randomUUID();console.error('hr_auth_failed',incident,error instanceof Error?error.name:'unknown');
  return NextResponse.json({error:'账号服务暂时不可用，请稍后重试。',incident},{status:503});
 }
}
