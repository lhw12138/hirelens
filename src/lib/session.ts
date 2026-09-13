import { jwtVerify, SignJWT } from "jose";
const key = () => {
 const secret=process.env.AUTH_SECRET||"local-auth-secret-change-before-production";
 if(process.env.NODE_ENV==='production'&&secret.length<32)throw new Error('AUTH_SECRET must be at least 32 characters in production');
 return new TextEncoder().encode(secret);
};
export async function createHrSession(email: string) { return new SignJWT({ email, role: "org_admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(key()); }
export async function verifyHrSession(token: string) { const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] }); return payload.role === "org_admin"; }

export async function createCandidateSession(id: string) {
  if (process.env.NODE_ENV === 'production' && (!process.env.AUTH_SECRET || process.env.AUTH_SECRET.length < 32)) throw new Error('候选人登录需要安全的 AUTH_SECRET。');
  return new SignJWT({ role: 'candidate' }).setSubject(id).setAudience('merittrace-candidate')
    .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('8h').sign(key());
}
export async function verifyCandidateSession(token: string) {
  const { payload } = await jwtVerify(token, key(), { algorithms: ['HS256'], audience: 'merittrace-candidate' });
  return payload.role === 'candidate' && typeof payload.sub === 'string' && /^[0-9a-f-]{36}$/i.test(payload.sub) ? payload.sub : null;
}
