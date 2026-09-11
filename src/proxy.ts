import { NextResponse, type NextRequest } from "next/server";
import { verifyHrSession } from "@/lib/session";

export function isPublicPath(path: string) {
 return path==='/login'||path==='/api/live'||path.startsWith('/respond/')||path.startsWith('/api/respond/')||path.startsWith('/api/auth/')||path.startsWith('/_next/')||path==='/favicon.ico';
}

export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
   const origin=request.headers.get('origin');
   if(origin && origin!==request.nextUrl.origin)return NextResponse.json({error:'请在当前网站内操作。'},{status:403});
 }
 if(isPublicPath(path))return NextResponse.next();
 const token=request.cookies.get("hirelens_session")?.value;
 if(!token||!(await verifyHrSession(token).catch(()=>false)))return path.startsWith('/api/') ? NextResponse.json({error:'请重新登录。'},{status:401}) : NextResponse.redirect(new URL("/login",request.url));
 return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
