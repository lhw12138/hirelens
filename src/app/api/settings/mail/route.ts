import { NextResponse } from "next/server";
import { z } from "zod";
import { requireOwner, WorkflowError } from "@/server/workflow/store";
import { getPool } from "@/server/db/client";
import { seal } from "@/lib/secret-box";
import { getMailSettings, verifyMailSettings } from "@/server/workflow/mail";
import { failure } from "../../tasks/route";

const schema = z.object({ host: z.string().trim().min(3).max(253).refine(value => !/[\r\n]/.test(value) && !/^(localhost|\[?::1\]?|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(value), "请填写公网 SMTP 域名"), port: z.union([z.literal(465), z.literal(587)]), username: z.string().trim().min(1).max(254), password: z.string().min(1).max(500), fromEmail: z.email().max(254), displayName: z.string().trim().min(1).max(60).refine(value => !/[\r\n]/.test(value)) });
export async function GET() { try {
  const owner = await requireOwner(); const value = await getMailSettings(owner);
  return NextResponse.json(value ? { configured: true, host: value.host, port: value.port, username: value.username, fromEmail: value.fromEmail, displayName: value.displayName } : { configured: false });
} catch (error) { return failure(error); } }
export async function PUT(request: Request) { try {
  const owner = await requireOwner(); const value = schema.parse(await request.json()); const settings = { ...value, secure: value.port === 465 };
  try { await verifyMailSettings(settings); } catch { throw new WorkflowError("无法登录该邮箱的 SMTP 服务。请检查服务器、邮箱账号和授权码。", 400); }
  await getPool().query(`INSERT INTO email_settings(owner_email,smtp_host,smtp_port,smtp_secure,smtp_username,smtp_password_ciphertext,from_email,display_name) VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(owner_email) DO UPDATE SET smtp_host=EXCLUDED.smtp_host,smtp_port=EXCLUDED.smtp_port,smtp_secure=EXCLUDED.smtp_secure,smtp_username=EXCLUDED.smtp_username,smtp_password_ciphertext=EXCLUDED.smtp_password_ciphertext,from_email=EXCLUDED.from_email,display_name=EXCLUDED.display_name,updated_at=now()`, [owner, settings.host, settings.port, settings.secure, settings.username, seal(settings.password), settings.fromEmail, settings.displayName]);
  return NextResponse.json({ configured: true });
} catch (error) { return failure(error); } }
export async function DELETE() { try { await getPool().query("DELETE FROM email_settings WHERE owner_email=$1", [await requireOwner()]); return NextResponse.json({ ok: true }); } catch (error) { return failure(error); } }
