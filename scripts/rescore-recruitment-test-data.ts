import { assessPerson } from "../src/server/workflow/model";
import type { HiringTask, Person } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";

async function retry(task: HiringTask, person: Person) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try { return await assessPerson(task, person, "combined"); }
    catch (error) { lastError = error; console.warn(`${task.title}/${person.name} 第 ${attempt} 次失败：${error instanceof Error ? error.message : error}`); }
  }
  throw lastError;
}

const rows = await getPool().query("select id,version,data from hiring_tasks where data->>'demoDatasetKey' like 'user-synthetic-%' order by data->>'title'");
for (const row of rows.rows as Array<{ id: string; version: number; data: HiringTask }>) {
  const task = row.data;
  console.log(`\n更新：${task.title}`);
  for (const person of task.candidates) {
    console.log(`  综合评估：${person.name}`);
    const previous = person.assessment;
    person.assessment = await retry(task, person);
    if (previous) person.assessmentHistory = [...(person.assessmentHistory || []), previous];
    task.audit.push({ at: new Date().toISOString(), action: "按新版冲突识别规则重新生成综合评估", candidateId: person.id });
    await getPool().query("update hiring_tasks set data=$2::jsonb,version=version+1,updated_at=now() where id=$1", [row.id, JSON.stringify(task)]);
  }
}
await getPool().end();
console.log("\n新版综合评估已全部保存。");
