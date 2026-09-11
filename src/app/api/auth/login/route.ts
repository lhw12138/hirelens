import { NextResponse } from "next/server";
import { createHrSession } from "@/lib/session";
export async function POST(request:Request){
 const body=await request.json() as {email?:string;password?:string};
 const email=process.env.HR_ADMIN_EMAIL||"admin@hirelens.local";const password=process.env.HR_ADMIN_PASSWORD||"hirelens-demo";
 if(body.email!==email||body.password!==password)return NextResponse.json({error:"invalid_credentials"},{status:401});
 const response=NextResponse.json({ok:true});response.cookies.set("hirelens_session",await createHrSession(email),{httpOnly:true,sameSite:"lax",secure:process.env.NODE_ENV==="production",path:"/",maxAge:60*60*8});return response;
}

