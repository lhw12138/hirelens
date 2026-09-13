import { claimNextJob, failJob, finishJob } from "@/server/queue/jobs";

async function handle(type: string, payload: unknown) {
  if (type === "parse_resume" || type === "embed_chunks" || type === "run_evaluation") {
    console.info(JSON.stringify({ event: "job_processed", type, payloadDigest: JSON.stringify(payload).length }));
    return;
  }
  throw new Error(`Unsupported job type: ${type}`);
}

async function run() {
  console.info("MeritTrace worker started");
  while (true) {
    const job = await claimNextJob();
    if (!job) { await new Promise((resolve) => setTimeout(resolve, 1500)); continue; }
    try { await handle(job.type, job.payload); await finishJob(job.id); }
    catch (error) { await failJob(job.id, job.attempts, error instanceof Error ? error.message : "unknown worker error"); }
  }
}
run().catch((error) => { console.error(error instanceof Error ? error.message : "worker stopped"); process.exit(1); });
