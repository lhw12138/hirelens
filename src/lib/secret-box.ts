import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function key() {
  const material = process.env.SETTINGS_ENCRYPTION_KEY || process.env.AUTH_SECRET || "local-settings-key-change-before-production";
  return createHash("sha256").update(material).digest();
}
export function seal(value: string) {
  const iv = randomBytes(12); const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `v1.${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}
export function open(value: string) {
  const [version, iv, tag, encrypted] = value.split("."); if (version !== "v1" || !iv || !tag || !encrypted) throw new Error("Invalid secret");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url")); decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}
