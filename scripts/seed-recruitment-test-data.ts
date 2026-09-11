import { randomUUID } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { chunkDocument } from "../src/lib/chunking";
import { questionsFor, type Assessment, type HiringTask, type Person, type Source } from "../src/lib/workflow";
import { getPool } from "../src/server/db/client";
import { parseResume } from "../src/server/documents/parse";
import { assessPerson, parseJob } from "../src/server/workflow/model";

const sourceRoot = process.argv.find((value) => value.startsWith("--source="))?.slice(9) || process.env.HIRELENS_TEST_DATA || "C:\\Users\\lhw\\Desktop\\hirelen";
const shouldScore = process.argv.includes("--score");
const validateOnly = process.argv.includes("--validate-only");
const owner = process.env.HR_ADMIN_EMAIL || "admin@hirelens.local";

function cleanMarkdown(value: string) {
  return value.replace(/^---\s*[\s\S]*?\n---\s*/u, "").replace(/^>?.*(?:Coze|扣子).*(?:生成|导出).*$/gimu, "").trim();
}
function hideName(value: string, name: string) { return value.replaceAll(name, "[姓名已隐藏]"); }
function titleFromJd(jd: string, fallback: string) { return jd.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback; }
function candidateName(filename: string) { return filename.match(/简历-(.+)\.pdf$/u)?.[1]?.trim() || basename(filename, ".pdf"); }

async function retryAssessment(task: HiringTask, person: Person, phase: "screening" | "combined") {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try { return await assessPerson(task, person, phase); }
    catch (error) { lastError = error; console.warn(`  ${person.name} ${phase} 第 ${attempt} 次失败：${error instanceof Error ? error.message : error}`); }
  }
  throw lastError;
}

async function buildPerson(directory: string, resumeFile: string): Promise<Person> {
  const name = candidateName(resumeFile);
  const parsed = await parseResume(await readFile(join(directory, resumeFile)), "application/pdf");
  const resume = hideName(parsed.redactedText, name);
  const resumeSources: Source[] = parsed.chunks.map((chunk) => ({
    id: `resume-${randomUUID()}`,
    kind: "resume",
    locator: `${chunk.section}${chunk.page ? ` · 第 ${chunk.page} 页` : ""} · 字符 ${chunk.start + 1}–${chunk.end}`,
    text: hideName(chunk.text, name),
  }));
  const interviewFile = join(directory, `面试记录-${name}.md`);
  const interviewRecord = hideName(cleanMarkdown(await readFile(interviewFile, "utf8")), name);
  const answerSources: Source[] = chunkDocument([{ section: "面试记录确认稿", text: interviewRecord }], 700, 80).map((chunk) => ({
    id: `answer-${randomUUID()}`,
    kind: "answer",
    locator: `面试记录确认稿 · 字符 ${chunk.start + 1}–${chunk.end}`,
    text: chunk.text,
  }));
  return {
    id: randomUUID(), name, synthetic: true, filename: resumeFile, resume, resumeConfirmed: true,
    sources: [...resumeSources, ...answerSources], questions: [], answers: {}, interviewComplete: true,
    shortlisted: true, interviewRecord,
  };
}

async function persist(task: HiringTask, existingVersion?: number) {
  const pool = getPool();
  if (existingVersion === undefined) {
    await pool.query("insert into hiring_tasks (id,owner_email,version,data) values ($1,$2,1,$3::jsonb)", [task.id, owner, JSON.stringify(task)]);
    return 1;
  }
  await pool.query("update hiring_tasks set data=$2::jsonb,version=version+1,updated_at=now() where id=$1", [task.id, JSON.stringify(task)]);
  return existingVersion + 1;
}

async function main() {
  const directories = (await readdir(sourceRoot, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => join(sourceRoot, entry.name));
  if (!directories.length) throw new Error(`未在 ${sourceRoot} 找到测试数据目录。`);
  const results: Array<{ id: string; title: string; people: number; scored: number }> = [];
  for (const directory of directories) {
    const files = await readdir(directory);
    const jdFile = files.find((file) => /^JD-.+\.md$/iu.test(file));
    const resumeFiles = files.filter((file) => /简历-.+\.pdf$/iu.test(file)).sort((a, b) => a.localeCompare(b, "zh-CN"));
    if (!jdFile || !resumeFiles.length) continue;
    const datasetKey = `user-synthetic-${basename(directory).toLowerCase()}`;
    const jd = cleanMarkdown(await readFile(join(directory, jdFile), "utf8"));
    const title = titleFromJd(jd, basename(directory));
    console.log(`\n导入：${title}（${resumeFiles.length} 位候选人）`);
    const people = await Promise.all(resumeFiles.map((file) => buildPerson(directory, file)));
    if (validateOnly) {
      console.log(`  本地校验通过：${people.length} 份简历和 ${people.length} 份面试记录；未连接数据库，未调用外部模型。`);
      results.push({ id: "未创建", title, people: people.length, scored: 0 });
      continue;
    }
    const criteria = await parseJob(jd);
    people.forEach((person) => { person.questions = questionsFor(criteria); });
    const existing = await getPool().query("select id,version from hiring_tasks where owner_email=$1 and data->>'demoDatasetKey'=$2 limit 1", [owner, datasetKey]);
    const existingRow = existing.rows[0] as { id: string; version: number } | undefined;
    const now = new Date().toISOString();
    const task: HiringTask = {
      id: existingRow?.id || randomUUID(), demoDatasetKey: datasetKey, title, jd, synthetic: true, confirmed: true,
      criteria, evaluationCriteria: criteria.map((item) => ({ ...item })), candidates: people,
      audit: [{ at: now, action: "导入用户提供的合成测试资料" }, { at: now, action: "AI 根据 JD 生成岗位专属评分维度" }],
    };
    let version = await persist(task, existingRow?.version);
    await getPool().query("delete from workflow_vectors where task_id=$1", [task.id]);
    let scored = 0;
    if (shouldScore) {
      for (const person of task.candidates) {
        console.log(`  评分：${person.name}`);
        person.screening = await retryAssessment(task, person, "screening") as Assessment;
        task.audit.push({ at: new Date().toISOString(), action: "合成候选人简历初筛已生成", candidateId: person.id });
        version = await persist(task, version);
        person.assessment = await retryAssessment(task, person, "combined") as Assessment;
        task.audit.push({ at: new Date().toISOString(), action: "合成候选人综合评估已生成", candidateId: person.id });
        version = await persist(task, version);
        scored += 1;
      }
    }
    results.push({ id: task.id, title, people: people.length, scored });
  }
  console.log("\n完成：");
  for (const result of results) console.log(`${result.title} | ${result.people} 人 | 已完整评分 ${result.scored} 人${result.id === "未创建" ? " | 仅完成本地校验" : ` | /tasks/${result.id}/compare`}`);
  if (!validateOnly) await getPool().end();
}

main().catch(async (error) => {
  console.error(error instanceof Error ? error.stack || error.message : error);
  if (!validateOnly) await getPool().end().catch(() => undefined);
  process.exitCode = 1;
});
