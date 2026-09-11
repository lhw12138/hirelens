import "server-only";
import { getPool } from "@/server/db/client";

export type WorkerService = "scoring-worker" | "evaluation-worker";

export async function recordHeartbeat(service: WorkerService, status = "ok") {
  await getPool().query(`INSERT INTO service_heartbeats(service,status,details,last_seen) VALUES($1,$2,'{}'::jsonb,now()) ON CONFLICT(service) DO UPDATE SET status=EXCLUDED.status,details='{}'::jsonb,last_seen=now()`, [service, status]);
}
