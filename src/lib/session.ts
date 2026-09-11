import { jwtVerify, SignJWT } from "jose";
const key = () => new TextEncoder().encode(process.env.AUTH_SECRET || "local-auth-secret-change-before-production");
export async function createHrSession(email: string) { return new SignJWT({ email, role: "org_admin" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("8h").sign(key()); }
export async function verifyHrSession(token: string) { const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] }); return payload.role === "org_admin"; }

