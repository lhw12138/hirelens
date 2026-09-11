import assert from "node:assert/strict";
import { comparisonTotal, hardRequirementResult, rankCandidates, type ComparisonStage } from "../src/lib/candidate-comparison";
import type { HiringTask } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";

const rows = await getPool().query("select id,data from hiring_tasks where data->>'demoDatasetKey' like 'user-synthetic-%' order by data->>'title'");
assert.equal(rows.rowCount, 3, "应存在三套合成招聘任务");
const output = [];
for (const row of rows.rows as Array<{ id: string; data: HiringTask }>) {
  const task = row.data;
  assert.equal(task.candidates.length, 4);
  assert.equal(task.synthetic, true);
  assert.ok(task.criteria.length >= 3 && task.criteria.length <= 8);
  assert.equal(task.criteria.reduce((sum, item) => sum + item.weight, 0), 100);
  for (const person of task.candidates) {
    assert.ok(person.screening && person.assessment, `${task.title}/${person.name} 缺少评分`);
    assert.ok(!person.resume.includes(person.name) && !person.interviewRecord?.includes(person.name), `${task.title}/${person.name} 姓名未隐藏`);
    assert.ok(!/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu.test(person.sources.map((item) => item.text).join("\n")), `${task.title}/${person.name} 评分证据仍含邮箱`);
    assert.ok(!/(?<!\d)1[3-9]\d{9}(?!\d)/u.test(person.sources.map((item) => item.text).join("\n")), `${task.title}/${person.name} 评分证据仍含手机号`);
  }
  const rankings = (stage: ComparisonStage) => {
    const criteria = stage === "screening" ? task.criteria : task.evaluationCriteria || task.criteria;
    return rankCandidates(task.candidates, criteria, stage).map((person) => ({
      name: person.name,
      total: comparisonTotal(person, criteria, stage)?.toFixed(1) || "待核实",
      hardRequirements: hardRequirementResult(person, criteria, stage).state,
      insufficient: (stage === "screening" ? person.screening : person.assessment)?.scores.filter((item) => item.status === "insufficient").length || 0,
      conflicts: (stage === "screening" ? person.screening : person.assessment)?.scores.filter((item) => item.status === "conflict").length || 0,
    }));
  };
  output.push({ id: row.id, title: task.title, criteria: task.criteria.map((item) => `${item.name} ${item.weight}%`), screening: rankings("screening"), combined: rankings("combined") });
}
console.log(JSON.stringify({ status: "PASS", tasks: output }, null, 2));
await getPool().end();
