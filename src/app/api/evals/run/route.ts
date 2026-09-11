import { NextResponse } from "next/server";
import { getPool } from "@/server/db/client";
import { currentEvaluationModel, ensureEvaluationDataset, EVAL_PROMPT_VERSION, loadEvaluationCases } from "@/server/evaluation/runner";
import { requireOwner, WorkflowError } from "@/server/workflow/store";

async function payload() {
  const dataset = await ensureEvaluationDataset();
  const runs = await getPool().query("SELECT id,model_id AS \"modelId\",prompt_version AS \"promptVersion\",status,metrics,started_at AS \"startedAt\",completed_at AS \"completedAt\",created_at AS \"createdAt\" FROM eval_runs WHERE dataset_id=$1 ORDER BY created_at DESC LIMIT 8", [dataset.id]);
  const fixtures = await loadEvaluationCases(dataset.id);
  const scenarios = Object.entries(fixtures.reduce<Record<string, number>>((all, item) => ({ ...all, [item.scenario]: (all[item.scenario] || 0) + 1 }), {}));
  const cases=fixtures.map(item=>({id:item.id,role:item.role,title:item.title,scenario:item.scenario,criterion:item.criterion,sources:item.sources,expected:item.expected}));
  return { dataset: { ...dataset, roles: new Set(fixtures.map((item) => item.role)).size, scenarios, cases }, runs: runs.rows };
}

export async function GET() {
  try { await requireOwner(); return NextResponse.json(await payload()); }
  catch (error) { return failure(error); }
}

export async function POST() {
  try {
    await requireOwner();
    const dataset = await ensureEvaluationDataset();
    const active = await getPool().query<{ id: string }>("SELECT id FROM eval_runs WHERE dataset_id=$1 AND status IN ('queued','running') ORDER BY created_at DESC LIMIT 1", [dataset.id]);
    if (!active.rows[0]) await getPool().query("INSERT INTO eval_runs(dataset_id,model_id,prompt_version,status,metrics) VALUES($1,$2,$3,'queued',$4::jsonb)", [dataset.id, currentEvaluationModel(), EVAL_PROMPT_VERSION, JSON.stringify({ completedCases: 0, totalCases: dataset.totalCases })]);
    return NextResponse.json(await payload(), { status: active.rows[0] ? 200 : 202 });
  } catch (error) { return failure(error); }
}

function failure(error: unknown) {
  if (error instanceof WorkflowError) return NextResponse.json({ error: error.message }, { status: error.status });
  return NextResponse.json({ error: error instanceof Error ? error.message : "暂时无法启动评测，请稍后重试。" }, { status: 503 });
}
