import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { requireOwner, loadTask, WorkflowError } from "@/server/workflow/store";
import { getPool } from "@/server/db/client";
import { validateNotice, noticeContent, noticeInputSchema, type NoticeRecord } from "@/lib/interview-notice";
import { seal, open } from "@/lib/secret-box";
import { getMailSettings, deliverNotice } from "@/server/workflow/mail";
import { candidateEmails } from "@/server/workflow/candidate-contact";
import { failure } from "../../route";
type Context = { params: Promise<{ id: string }> };
function publicRecord(row: Record<string, unknown>): NoticeRecord { return { id: row.id as string, candidateId: row.candidate_id as string, email: open(row.recipient_ciphertext as string), payload: row.payload as NoticeRecord["payload"], status: row.status as NoticeRecord["status"], createdAt: new Date(row.created_at as string).toISOString(), updatedAt: new Date(row.updated_at as string).toISOString() }; }
export async function GET(request: Request, context: Context) { try {
  const owner = await requireOwner(); const id = z.uuid().parse((await context.params).id); const task = await loadTask(id, owner);
  const requestedCandidate = new URL(request.url).searchParams.get("candidateId"); const candidateId = requestedCandidate ? z.uuid().parse(requestedCandidate) : null;
  const candidate = candidateId ? task.data.candidates.find((person) => person.id === candidateId) : undefined; if (candidateId && !candidate) throw new WorkflowError("找不到该候选人。", 404);
  await getPool().query("UPDATE interview_notices SET status='unknown',updated_at=now() WHERE task_id=$1 AND status='sending' AND updated_at<now()-interval '2 minutes'", [id]);
  const result = candidateId ? await getPool().query("SELECT id,candidate_id,recipient_ciphertext,payload,status,created_at,updated_at FROM interview_notices WHERE task_id=$1 AND candidate_id=$2 ORDER BY created_at DESC", [id,candidateId]) : await getPool().query("SELECT id,candidate_id,recipient_ciphertext,payload,status,created_at,updated_at FROM interview_notices WHERE task_id=$1 ORDER BY created_at DESC", [id]); const settings = await getMailSettings(owner);
  return NextResponse.json({ configured: !!settings, from: settings?.fromEmail || null, contactEmails: candidateEmails(candidate), items: result.rows.map(publicRecord) });
} catch (error) { return failure(error); } }
const bodySchema = z.discriminatedUnion("action", [z.object({ action: z.literal("preview"), candidateId: z.uuid(), details: noticeInputSchema }), z.object({ action: z.literal("send"), noticeId: z.uuid(), confirmed: z.literal(true) })]);
export async function POST(request: Request, context: Context) { try {
  const owner = await requireOwner(); const id = z.uuid().parse((await context.params).id); const input = bodySchema.parse(await request.json()); const task = await loadTask(id, owner); const db = getPool();
  if (input.action === "preview") {
    const candidate = task.data.candidates.find(person => person.id === input.candidateId); if (!candidate?.shortlisted) throw new WorkflowError("请先选择候选人进入面试。");
    let details; try { details = validateNotice(input.details); } catch { throw new WorkflowError("请填写有效邮箱，并选择未来一年内的面试时间。"); }
    const { email, ...payload } = { ...details, ...noticeContent(details, task.data.title) }; const contentKey = createHash("sha256").update(JSON.stringify([id, candidate.id, details])).digest("hex");
    const result = await db.query(`INSERT INTO interview_notices(task_id,candidate_id,content_key,recipient_ciphertext,payload) VALUES($1,$2,$3,$4,$5::jsonb) ON CONFLICT(content_key) DO UPDATE SET content_key=EXCLUDED.content_key RETURNING id,candidate_id,recipient_ciphertext,payload,status,created_at,updated_at`, [id, candidate.id, contentKey, seal(email), JSON.stringify(payload)]);
    return NextResponse.json(publicRecord(result.rows[0]));
  }
  if (!await getMailSettings(owner)) throw new WorkflowError("尚未配置发信邮箱。可以先复制通知，配置后再发送。", 503);
  const connection = await db.connect(); let notice: NoticeRecord;
  try {
    await connection.query("BEGIN"); const locked = await connection.query("SELECT data FROM hiring_tasks WHERE id=$1 AND owner_email=$2 AND COALESCE(data->>'archivedAt',data->>'deletedAt') IS NULL FOR UPDATE", [id, owner]); if (!locked.rowCount) throw new WorkflowError("任务已归档，不能发送。", 409);
    const rows = await connection.query("SELECT * FROM interview_notices WHERE id=$1 AND task_id=$2 FOR UPDATE", [input.noticeId, id]); if (!rows.rowCount) throw new WorkflowError("找不到通知，请重新预览。", 404); notice = publicRecord(rows.rows[0]);
    if (notice.status === "sending" && Date.now() - Date.parse(notice.updatedAt) > 120_000) { await connection.query("UPDATE interview_notices SET status='unknown',updated_at=now() WHERE id=$1", [notice.id]); notice = { ...notice, status: "unknown", updatedAt: new Date().toISOString() }; }
    if (notice.status !== "draft") { await connection.query("COMMIT"); return NextResponse.json(notice); }
    if (Date.parse(notice.payload.startsAt) <= Date.now()) throw new WorkflowError("面试时间已过，请重新填写并预览。");
    const count = await connection.query("SELECT count(*)::int AS n FROM interview_notices WHERE task_id=$1 AND status!='draft' AND updated_at>now()-interval '1 hour'", [id]); if (count.rows[0].n >= 30) throw new WorkflowError("本任务一小时内发送次数过多，请稍后再试。", 429);
    await connection.query("UPDATE interview_notices SET status='sending',updated_at=now() WHERE id=$1", [notice.id]); await connection.query("COMMIT");
  } catch (error) { await connection.query("ROLLBACK"); throw error; } finally { connection.release(); }
  let status: NoticeRecord["status"] = "accepted"; try { await deliverNotice(owner, notice); } catch { status = "unknown"; }
  const saved = await db.query("UPDATE interview_notices SET status=$2,updated_at=now() WHERE id=$1 RETURNING id,candidate_id,recipient_ciphertext,payload,status,created_at,updated_at", [notice.id, status]); return NextResponse.json(publicRecord(saved.rows[0]));
} catch (error) { return failure(error); } }
