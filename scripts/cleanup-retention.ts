import type { HiringTask } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";
import { objectStore } from "../src/server/storage/object-store";

const pool = getPool();
const due = await pool.query("SELECT id FROM hiring_tasks WHERE COALESCE(data->>'archivedAt',data->>'deletedAt') IS NOT NULL AND data->>'purgeAfter' IS NOT NULL AND (data->>'purgeAfter')::timestamptz <= now() ORDER BY updated_at LIMIT 100");
let removed = 0;
for (const row of due.rows as Array<{ id: string }>) {
  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const locked = await connection.query("SELECT data FROM hiring_tasks WHERE id=$1 FOR UPDATE", [row.id]);
    const task = locked.rows[0]?.data as HiringTask | undefined;
    if (!task?.purgeAfter || !(task.archivedAt || task.deletedAt) || Date.parse(task.purgeAfter) > Date.now()) { await connection.query("ROLLBACK"); continue; }
    await objectStore.deletePrefix(`tasks/${row.id}/`);
    await connection.query("DELETE FROM hiring_tasks WHERE id=$1", [row.id]);
    await connection.query("COMMIT");
    removed += 1;
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    console.error(`Failed to purge archived task ${row.id}:`, error instanceof Error ? error.message : "unknown error");
    process.exitCode = 1;
  } finally {
    connection.release();
  }
}
console.log(JSON.stringify({ checked: due.rowCount, permanentlyDeleted: removed }));
await pool.end();
