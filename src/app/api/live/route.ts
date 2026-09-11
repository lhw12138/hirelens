import { NextResponse } from "next/server";

export function GET(){return NextResponse.json({status:"ok",service:"hirelens-web"},{headers:{"cache-control":"no-store"}});}
