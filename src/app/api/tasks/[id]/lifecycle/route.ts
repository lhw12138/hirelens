import { NextResponse } from "next/server";
import { z } from "zod";
import { setRetention, taskIsArchived, type RetentionDays } from "@/lib/data-lifecycle";
import { scoringActive } from "@/lib/scoring-job";
import type { HiringTask } from "@/lib/workflow";
import { getPool } from "@/server/db/client";
import { objectStore } from "@/server/storage/object-store";
import { publicTaskRecord } from "@/server/workflow/candidate-contact";
import { requireOwner, WorkflowError } from "@/server/workflow/store";
import { failure } from "../../route";

const inputSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("retention"), version: z.number().int().positive(), days: z.union([z.literal(30), z.literal(90), z.null()]) }),
  z.object({ action: z.literal("revokeInvitation"), version: z.number().int().positive(), candidateId: z.uuid() }),
  z.object({ action: z.literal("deleteCandidate"), version: z.number().int().positive(), candidateId: z.uuid(), confirmName: z.string().min(1).max(60) }),
  z.object({ action: z.literal("purgeTask"), version: z.number().int().positive(), confirmTitle: z.string().max(100) }),
]);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const connection = await getPool().connect();
  try {
    const owner = await requireOwner();
    const id = z.uuid().parse((await context.params).id);
    const input = inputSchema.parse(await request.json());
    await connection.query("BEGIN");
    const locked = await connection.query("SELECT id,version,data,updated_at FROM hiring_tasks WHERE id=$1 AND owner_email=$2 FOR UPDATE", [id, owner]);
    if (!locked.rowCount) throw new WorkflowError("找不到这项招聘任务。", 404);
    const record = locked.rows[0] as { id: string; version: number; data: HiringTask; updated_at: Date };
    if (record.version !== input.version) throw new WorkflowError("任务刚有更新，请刷新后重试。", 409);
    const task = record.data;

    if (input.action === "purgeTask") {
      if (!taskIsArchived(task)) throw new WorkflowError("请先归档任务，再执行永久删除。", 409);
      if (input.confirmTitle !== (task.title || "未命名招聘任务")) throw new WorkflowError("任务名称不一致，未执行删除。", 400);
      await objectStore.deletePrefix(`tasks/${id}/`);
      await connection.query("DELETE FROM hiring_tasks WHERE id=$1 AND owner_email=$2 AND version=$3", [id, owner, input.version]);
      await connection.query("COMMIT");
      return NextResponse.json({ ok: true, permanentlyDeleted: true });
    }

    if (input.action === "retention") {
      setRetention(task, input.days as RetentionDays);
      task.audit.push({ at: new Date().toISOString(), action: input.days === null ? "设置任务归档后长期保留" : `设置任务归档 ${input.days} 天后永久删除` });
    } else {
      if (taskIsArchived(task)) throw new WorkflowError("已归档任务不能修改候选人资料，请先恢复。", 409);
      const person = task.candidates.find((item) => item.id === input.candidateId);
      if (!person) throw new WorkflowError("找不到该候选人。", 404);
      if (input.action === "revokeInvitation") {
        if (!person.invitation) throw new WorkflowError("该候选人当前没有有效访问链接。", 409);
        person.invitation = undefined;
        task.audit.push({ at: new Date().toISOString(), action: "撤销候选人访问链接", candidateId: person.id });
      } else {
        if (input.confirmName !== person.name) throw new WorkflowError("候选人称呼不一致，未执行删除。", 400);
        if (scoringActive(task.scoringJob) && task.scoringJob?.candidateId === person.id) throw new WorkflowError("该候选人正在后台评分，请等待完成后再删除。", 409);
        await objectStore.deletePrefix(`tasks/${id}/${person.id}/`);
        await connection.query("DELETE FROM workflow_vectors WHERE task_id=$1 AND candidate_id=$2", [id, person.id]);
        await connection.query("DELETE FROM interview_notices WHERE task_id=$1 AND candidate_id=$2", [id, person.id]);
        task.candidates = task.candidates.filter((item) => item.id !== person.id);
        task.audit.push({ at: new Date().toISOString(), action: "永久删除一位候选人的简历、面试记录、评分、向量、通知地址和访问链接" });
      }
    }

    const updated = await connection.query("UPDATE hiring_tasks SET data=$1::jsonb,version=version+1,updated_at=now() WHERE id=$2 AND owner_email=$3 AND version=$4 RETURNING id,owner_email,version,data,created_at,updated_at", [JSON.stringify(task), id, owner, input.version]);
    if (!updated.rowCount) throw new WorkflowError("任务刚有更新，请刷新后重试。", 409);
    await connection.query("COMMIT");
    return NextResponse.json(publicTaskRecord({ id: updated.rows[0].id, ownerEmail: updated.rows[0].owner_email, version: updated.rows[0].version, data: updated.rows[0].data, createdAt: updated.rows[0].created_at, updatedAt: updated.rows[0].updated_at }));
  } catch (error) {
    await connection.query("ROLLBACK").catch(() => undefined);
    return failure(error);
  } finally {
    connection.release();
  }
}
