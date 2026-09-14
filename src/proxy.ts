import { NextResponse, type NextRequest } from "next/server";
import { verifyHrSession, verifyCandidateSession } from "@/lib/session";

export function isPublicPath(path: string) {
 return path==='/login'||path==='/api/live'||path.startsWith('/respond/')||path.startsWith('/api/respond/')||path.startsWith('/api/auth/')||path.startsWith('/_next/')||path==='/favicon.ico';
}

export function isAllowedOrigin(origin: string | null, requestOrigin: string, configuredOrigin?: string) {
 if(!origin)return true;
 const normalize=(value:string|undefined)=>{try{return value?new URL(value).origin:null;}catch{return null;}};
 const received=normalize(origin);
 return received!==null&&[normalize(requestOrigin),normalize(configuredOrigin)].includes(received);
}

export function isInternalEvalPath(path:string){return path==='/evals'||path.startsWith('/api/evals/');}

export async function proxy(request:NextRequest){
 const path=request.nextUrl.pathname;
 if(isInternalEvalPath(path)&&process.env.ENABLE_INTERNAL_EVALS!=='true')return path.startsWith('/api/')?NextResponse.json({error:'Not found'},{status:404}):NextResponse.redirect(new URL('/',request.url));
 if(!['GET','HEAD','OPTIONS'].includes(request.method)) {
   const origin=request.headers.get('origin');
   if(!isAllowedOrigin(origin,request.nextUrl.origin,process.env.APP_ORIGIN))return NextResponse.json({error:'请在当前网站内操作。'},{status:403});
 }
 if(path==='/candidate/login'||path==='/api/candidate/auth')return NextResponse.next();
 if(path==='/candidate'||path.startsWith('/candidate/')||path.startsWith('/api/candidate/')) {
   const candidateToken=request.cookies.get('merittrace_candidate')?.value;
   if(!candidateToken||!await verifyCandidateSession(candidateToken).catch(()=>null))return path.startsWith('/api/')?NextResponse.json({error:'请登录候选人账号。'},{status:401}):NextResponse.redirect(new URL('/candidate/login',request.url));
   return NextResponse.next();
 }
 if(isPublicPath(path))return NextResponse.next();
 const token=request.cookies.get("hirelens_session")?.value;
 if(!token||!(await verifyHrSession(token).catch(()=>false)))return path.startsWith('/api/') ? NextResponse.json({error:'请重新登录。'},{status:401}) : NextResponse.redirect(new URL("/login",request.url));
 return NextResponse.next();
}
export const config={matcher:["/((?!_next/static|_next/image|favicon.ico).*)"]};
