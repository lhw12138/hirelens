import "server-only";
import { sql } from "drizzle-orm";
import { getDatabase } from "@/server/db/client";

export type BackgroundJobType = "parse_resume" | "embed_chunks" | "run_evaluation";
export async function enqueue(type: BackgroundJobType, payload: unknown, idempotencyKey: string) {
  const db = getDatabase();
  await db.execute(sql`insert into background_jobs (type,payload,idempotency_key,status) values (${type},${JSON.stringify(payload)}::jsonb,${idempotencyKey},'queued') on conflict (idempotency_key) do nothing`);
}
export async function claimNextJob() {
  const db = getDatabase();
  const rows = await db.execute(sql`update background_jobs set status='running', attempts=attempts+1, started_at=now(), updated_at=now() where id=(select id from background_jobs where status='queued' and run_after<=now() order by created_at for update skip locked limit 1) returning id,type,payload,attempts`);
  return rows.rows[0] as { id: string; type: BackgroundJobType; payload: unknown; attempts: number } | undefined;
}
export async function finishJob(id: string) { const db = getDatabase(); await db.execute(sql`update background_jobs set status='completed', completed_at=now(), updated_at=now() where id=${id}::uuid`); }
export async function failJob(id: string, attempts: number, message: string) {
  const db = getDatabase();
  const status = attempts >= 3 ? "failed" : "queued";
  await db.execute(sql`update background_jobs set status=${status}, last_error=${message.slice(0,500)}, run_after=now()+interval '30 seconds', updated_at=now() where id=${id}::uuid`);
}
