import { NextResponse } from "next/server";
export async function POST(){return NextResponse.json({error:"旧版接口已停用，请从招聘任务进入新版流程。",next:"/"},{status:410});}
