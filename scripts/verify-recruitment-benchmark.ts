import benchmarkJson from "../data/recruitment-benchmark-v1.json" with { type: "json" };
import { evaluateRecruitmentBenchmark, type RecruitmentBenchmark } from "../src/lib/recruitment-benchmark";
import type { HiringTask } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";

const pool = getPool();
const rows = await pool.query("select data from hiring_tasks where data->>'demoDatasetKey' like 'user-synthetic-%'");
const result = evaluateRecruitmentBenchmark(rows.rows.map((row) => row.data as HiringTask), benchmarkJson as unknown as RecruitmentBenchmark);
console.log(JSON.stringify(result, null, 2));
await pool.end();
if (!result.passed) process.exitCode = 1;
