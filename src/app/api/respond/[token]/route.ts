import { NextResponse } from "next/server";
const retired = () => NextResponse.json({ error: "在线作答已停用。请通过招聘负责人安排的会议参加面试。" }, { status: 410 });
export const GET = retired;
export const POST = retired;
