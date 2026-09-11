import pg from "pg";

const { Pool } = pg;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const { rows } = await pool.query<{
      jobs: string; candidates: string; documents: string; interviews: string;
      assessments: string; eval_cases: string; synthetic_audits: string;
    }>(`select
      (select count(*) from jobs where status='active') as jobs,
      (select count(*) from candidates where external_ref like 'synthetic-%') as candidates,
      (select count(*) from resume_documents where status='ready') as documents,
      (select count(*) from interview_sessions where status='completed') as interviews,
      (select count(*) from assessments where status in ('needs_review','confirmed')) as assessments,
      (select count(*) from eval_cases) as eval_cases,
      (select count(*) from audit_events where action='synthetic_demo_seeded') as synthetic_audits`);
    const result = Object.fromEntries(Object.entries(rows[0]).map(([key, value]) => [key, Number(value)]));
    const expected = { jobs: 1, candidates: 8, documents: 8, interviews: 6, assessments: 1, eval_cases: 100, synthetic_audits: 1 };
    const failed = Object.entries(expected).filter(([key, minimum]) => (result[key] ?? 0) < minimum);
    if (failed.length) throw new Error(`Synthetic flow incomplete: ${failed.map(([key]) => key).join(", ")}`);
    console.log(JSON.stringify({ status: "ready", synthetic: true, ...result }, null, 2));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
