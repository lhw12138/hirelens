import "server-only";
import nodemailer from "nodemailer";
import { getPool } from "@/server/db/client";
import { open } from "@/lib/secret-box";
import { calendarEvent, type NoticeRecord } from "@/lib/interview-notice";

export type MailSettings = { host: string; port: number; secure: boolean; username: string; password: string; fromEmail: string; displayName: string };
export async function getMailSettings(owner: string): Promise<MailSettings | null> {
  const result = await getPool().query("SELECT * FROM email_settings WHERE owner_email=$1", [owner]); const row = result.rows[0];
  return row ? { host: row.smtp_host, port: row.smtp_port, secure: row.smtp_secure, username: row.smtp_username, password: open(row.smtp_password_ciphertext), fromEmail: row.from_email, displayName: row.display_name } : null;
}
function transport(settings: MailSettings) {
  return nodemailer.createTransport({ host: settings.host, port: settings.port, secure: settings.secure, requireTLS: true, auth: { user: settings.username, pass: settings.password }, connectionTimeout: 15_000, greetingTimeout: 10_000, socketTimeout: 20_000, logger: false, debug: false, disableFileAccess: true, disableUrlAccess: true });
}
export async function verifyMailSettings(settings: MailSettings) { const smtp = transport(settings); try { await smtp.verify(); } finally { smtp.close(); } }
export async function deliverNotice(owner: string, record: NoticeRecord) {
  const settings = await getMailSettings(owner); if (!settings) throw new Error("mail not configured");
  const smtp = transport(settings); try {
    const from = { name: settings.displayName, address: settings.fromEmail };
    const info = await smtp.sendMail({ from, to: record.email, subject: record.payload.subject, text: record.payload.text, messageId: `<${record.id}@${settings.fromEmail.split("@")[1]}>`, icalEvent: { method: "REQUEST", filename: "interview.ics", content: calendarEvent(record.id, record.email, record.payload, settings.fromEmail) } });
    if (info.rejected.length || !info.accepted.length) throw new Error("mail rejected");
  } finally { smtp.close(); }
}
