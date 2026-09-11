import "server-only";
import { z } from "zod";
import { extractEmailAddresses } from "@/lib/redaction";
import { open, seal } from "@/lib/secret-box";
import type { HiringTask, Person } from "@/lib/workflow";
import { WorkflowError } from "@/server/workflow/store";

const emailListSchema = z.array(z.email().max(254)).max(5);
const tokenSchema = z.object({ owner: z.email(), emails: emailListSchema, issuedAt: z.number().int() });

export function createContactToken(owner: string, emails: string[]) {
  return emails.length ? seal(JSON.stringify({ owner, emails: emailListSchema.parse(emails), issuedAt: Date.now() })) : undefined;
}

export function contactCipherFromInput(owner: string, resume: string, token?: string) {
  let emails = extractEmailAddresses(resume);
  if (!emails.length && token) {
    try {
      const value = tokenSchema.parse(JSON.parse(open(token)));
      if (value.owner !== owner || Date.now() - value.issuedAt > 60 * 60 * 1000) throw new Error("expired");
      emails = value.emails;
    } catch {
      throw new WorkflowError("简历联系方式已过期，请重新上传简历。", 400);
    }
  }
  return emails.length ? seal(JSON.stringify(emails)) : undefined;
}

export function candidateEmails(person?: Person): string[] {
  if (!person?.contactEmailsCiphertext) return [];
  try { return emailListSchema.parse(JSON.parse(open(person.contactEmailsCiphertext))); }
  catch { return []; }
}

export function publicTaskRecord<T extends { data: HiringTask }>(row: T) {
  return { ...row, data: { ...row.data, candidates: row.data.candidates.map((person) => { const safe = { ...person }; delete safe.contactEmailsCiphertext; if (safe.invitation) safe.invitation = { hash: "", expiresAt: safe.invitation.expiresAt }; return safe; }) } };
}
