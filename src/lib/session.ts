import { jwtVerify, SignJWT } from "jose";
const key = () => {
 const secret=process.env.AUTH_SECRET||"local-auth-secret-change-before-production";
 if(process.env.NODE_ENV==='production'&&secret.length<32)throw new Error('AUTH_SECRET must be at least 32 characters in production');
 return new TextEncoder().encode(secret);
};
export type HrSession = {id: string; email: string};
export async function createHrSession(id: string, email: string) {
 return new SignJWT({email,role:'org_admin'}).setSubject(id).setAudience('merittrace-hr')
  .setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('8h').sign(key());
}
export async function verifyHrSession(token: string): Promise<HrSession|null> {
 const {payload}=await jwtVerify(token,key(),{algorithms:['HS256'],audience:'merittrace-hr'});
 return payload.role==='org_admin'&&typeof payload.sub==='string'&&/^[0-9a-f-]{36}$/i.test(payload.sub)&&typeof payload.email==='string'
  ?{id:payload.sub,email:payload.email}:null;
}

export async function createCandidateSession(id: string) {
  if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) throw new Error('候选人登录需要安全的 AUTH_SECRET。');
  return new SignJWT({ role: 'candidate' }).setSubject(id).setAudience('merittrace-candidate')
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(key());
}
export async function verifyCandidateSession(token: string) {
  const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], audience: 'merittrace-candidate' });
  return payload.role === 'candidate' && typeof payload.sub === 'string' && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : null;
}
