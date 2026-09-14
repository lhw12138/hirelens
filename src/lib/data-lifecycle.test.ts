import { describe, expect, it } from "vitest";
import { archiveTask, restoreTask, setRetention, taskIsArchived } from "./data-lifecycle";
import type { HiringTask } from "./workflow";

const task = (): HiringTask => ({ id: "task", title: "测试岗位", jd: "完整岗位说明", synthetic: true, confirmed: true, criteria: [], candidates: [], audit: [], scoringJob: { id: "job", candidateId: "candidate", action: "screen", status: "running", queuedAt: "2026-09-10T00:00:00.000Z" } });

describe("data lifecycle", () => {
  it("schedules permanent deletion from the archive time and cancels active scoring", () => {
    const value = setRetention(task(), 30);
    archiveTask(value, new Date("2026-09-10T00:00:00.000Z"));
    expect(value.purgeAfter).toBe("2026-10-10T00:00:00.000Z");
    expect(value.scoringJob?.status).toBe("cancelled");
  });
  it("cancels every queued candidate score when a task is archived", () => {
    const value = task();
    value.scoringJobs = [value.scoringJob!, { ...value.scoringJob!, id: "job-2", candidateId: "candidate-2", status: "queued" }];
    archiveTask(value, new Date("2026-09-10T00:00:00.000Z"));
    expect(value.scoringJobs.map(job => job.status)).toEqual(["cancelled", "cancelled"]);
  });
  it("keeps archived data until manual deletion when retention is disabled", () => {
    const value = archiveTask(setRetention(task(), null));
    expect(value.purgeAfter).toBeUndefined();
  });
  it("restores legacy deleted tasks without retaining a purge deadline", () => {
    const value = task(); value.deletedAt = "legacy"; value.purgeAfter = "soon";
    restoreTask(value);
    expect(taskIsArchived(value)).toBe(false);
    expect(value.purgeAfter).toBeUndefined();
  });
});
