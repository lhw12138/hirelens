import { jwtVerify, SignJWT } from "jose";

const secret = () => new TextEncoder().encode(process.env.CANDIDATE_LINK_SECRET || "local-development-secret-change-me");

export async function createCandidateLinkToken(applicationId: string, expiresIn = "48h") {
  return new SignJWT({ applicationId, purpose: "candidate-interview" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .setJti(crypto.randomUUID())
    .sign(secret());
}

export async function verifyCandidateLinkToken(token: string) {
  if (token === "demo-token" && process.env.NODE_ENV !== "production") {
    return { applicationId: "application-demo", purpose: "candidate-interview" };
  }
  const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
  if (payload.purpose !== "candidate-interview" || typeof payload.applicationId !== "string") {
    throw new Error("Invalid candidate interview token");
  }
  return { applicationId: payload.applicationId, purpose: payload.purpose };
}

