import { NextResponse } from "next/server";
import { createHrSession } from "@/lib/session";
import { accountPasswordError } from "@/lib/password-policy";
export async function POST(request:Request){
 const body=await request.json() as {email?:string;password?:string};
 const email=process.env.HR_ADMIN_EMAIL;const password=process.env.HR_ADMIN_PASSWORD;
 if(!email||!password)return NextResponse.json({error:"管理员账号尚未配置"},{status:503});
 if(accountPasswordError(password))return NextResponse.json({error:"管理员密码不符合当前规则，请更新服务器配置。"},{status:503});
 if(body.email!==email||body.password!==password)return NextResponse.json({error:"invalid_credentials"},{status:401});
 const response=NextResponse.json({ok:true});response.cookies.set("hirelens_session",await createHrSession(email),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});return response;
}
