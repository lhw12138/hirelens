import type { HiringTask } from "@/lib/workflow";

export type RetentionDays = 30 | 90 | null;

export function retentionLabel(days: RetentionDays) {
  return days === null ? "归档后长期保留" : `归档 ${days} 天后永久删除`;
}

export function setRetention(task: HiringTask, days: RetentionDays, now = new Date()) {
  task.retentionDays = days;
  if (task.archivedAt || task.deletedAt) task.purgeAfter = days === null ? undefined : new Date(now.getTime() + days * 86_400_000).toISOString();
  return task;
}

export function archiveTask(task: HiringTask, now = new Date()) {
  const archivedAt = now.toISOString();
  task.archivedAt = archivedAt;
  delete task.deletedAt;
  task.purgeAfter = task.retentionDays == null ? undefined : new Date(now.getTime() + task.retentionDays * 86_400_000).toISOString();
  if (task.scoringJob?.status === "queued" || task.scoringJob?.status === "running") task.scoringJob = { ...task.scoringJob, status: "cancelled", finishedAt: archivedAt };
  return task;
}

export function restoreTask(task: HiringTask) {
  delete task.archivedAt;
  delete task.deletedAt;
  delete task.purgeAfter;
  return task;
}

export function taskIsArchived(task: HiringTask) {
  return Boolean(task.archivedAt || task.deletedAt);
}
