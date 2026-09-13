import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import pg from "pg";
import { activeJob, candidates, financeCompetencies } from "../src/lib/demo-data";
import { skillPacks } from "../src/lib/skill-packs";

const { Pool } = pg;
const ids = {
  organization: "00000000-0000-4000-8000-000000000001",
  user: "00000000-0000-4000-8000-000000000002",
  job: "00000000-0000-4000-8000-000000000010",
  dataset: "00000000-0000-4000-8000-0000000000b0",
  assessment: "00000000-0000-4000-8000-000000000090",
} as const;

const uuid = (group: number, index: number) =>
  `00000000-0000-4000-8${group.toString(16).padStart(3, "0")}-${index.toString(16).padStart(12, "0")}`;

const resumeText = (name: string, index: number) => `【合成数据｜不对应任何真实个人】
姓名：${name}
电话：1380000${String(index).padStart(4, "0")}
邮箱：synthetic-${index}@example.com
地址：上海市示例区演示路 ${index} 号

工作经历
在某合成企业担任财务产品经理，负责核算、资金与经营分析场景的需求调研、产品规划和跨团队交付。

项目经历
主导财务共享平台 2.0 产品建设，协同财务、IT、风控与法务完成需求评审、方案确认和上线验证。建立需求优先级、灰度发布与问题复盘机制。

AI 产品能力
设计过基于检索增强生成的知识辅助方案，对比关键词、向量和混合检索，使用引用准确率、证据覆盖率与无依据结论率评估质量。`;

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  // Validate the fixture before any database or object-storage mutations.
  const evalRaw = JSON.parse(await readFile(resolve("data/eval-dataset-v1.json"), "utf8")) as {
    name: string; notice: string; cases: Array<Record<string, unknown>>;
  };
  if (!Array.isArray(evalRaw.cases) || !evalRaw.cases.length) throw new Error("Invalid synthetic evaluation dataset");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  const s3 = new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: process.env.S3_FORCE_PATH_STYLE !== "false",
    credentials: process.env.S3_ACCESS_KEY && process.env.S3_SECRET_KEY
      ? { accessKeyId: process.env.S3_ACCESS_KEY, secretAccessKey: process.env.S3_SECRET_KEY }
      : undefined,
  });

  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(72134001)");
    const existing = await client.query("select id from organizations where id=$1", [ids.organization]);
    if (existing.rowCount) {
      await client.query("rollback");
      console.log("Synthetic demo already exists; preserved existing scores and review history.");
      return;
    }
    await client.query(
      `insert into organizations (id, name) values ($1, $2)
       on conflict (id) do update set name = excluded.name, updated_at = now()`,
      [ids.organization, "HireLens 合成演示组织"],
    );
    const passwordHash = await bcrypt.hash(process.env.HR_ADMIN_PASSWORD || "hirelens-demo", 10);
    await client.query(
      `insert into users (id, organization_id, email, password_hash, name, role)
       values ($1,$2,$3,$4,$5,'hr_admin')
       on conflict (id) do update set email=excluded.email,password_hash=excluded.password_hash,updated_at=now()`,
      [ids.user, ids.organization, process.env.HR_ADMIN_EMAIL || "admin@hirelens.local", passwordHash, "演示招聘负责人"],
    );

    for (const pack of skillPacks) {
      await client.query(
        `insert into skill_packs (id,name,version,definition,active) values ($1,$2,$3,$4,true)
         on conflict (id) do update set name=excluded.name,version=excluded.version,definition=excluded.definition,active=true,updated_at=now()`,
        [pack.id, pack.name, pack.version, JSON.stringify(pack)],
      );
    }

    await client.query(
      `insert into jobs (id,organization_id,skill_pack_id,title,department,location,raw_description,status,confirmed_at)
       values ($1,$2,$3,$4,$5,$6,$7,'active',now())
       on conflict (id) do update set title=excluded.title,department=excluded.department,location=excluded.location,raw_description=excluded.raw_description,status='active',confirmed_at=now(),updated_at=now()`,
      [ids.job, ids.organization, activeJob.skillPackId, activeJob.title, activeJob.department, activeJob.location,
        "【合成 JD】负责财务 AI 场景研究、需求定义、RAG 与 Agent 方案评测，并推动财务、算法、研发和 IT 团队完成上线。"],
    );

    for (const [index, competency] of financeCompetencies.entries()) {
      await client.query(
        `insert into competencies (id,job_id,key,name,description,weight,must_have,sort_order)
         values ($1,$2,$3,$4,$5,$6,$7,$8)
         on conflict (id) do update set name=excluded.name,description=excluded.description,weight=excluded.weight,must_have=excluded.must_have,sort_order=excluded.sort_order,updated_at=now()`,
        [uuid(2, index + 1), ids.job, competency.id, competency.name, competency.description, competency.weight, competency.mustHave, index],
      );
    }

    for (const [index, candidate] of candidates.entries()) {
      const candidateId = uuid(3, index + 1);
      const applicationId = uuid(4, index + 1);
      const documentId = uuid(5, index + 1);
      const planId = uuid(6, index + 1);
      const sessionId = uuid(7, index + 1);
      const raw = resumeText(candidate.name, index + 1);
      const redacted = raw
        .replace(/1[3-9]\d{9}/g, "[手机号已脱敏]")
        .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[邮箱已脱敏]")
        .replace(/地址：[^\n]+/g, "地址：[详细地址已脱敏]");
      const objectKey = `synthetic/resumes/${candidate.id}.txt`;

      await s3.send(new PutObjectCommand({
        Bucket: process.env.S3_BUCKET || "hirelens",
        Key: objectKey,
        Body: Buffer.from(raw, "utf8"),
        ContentType: "text/plain; charset=utf-8",
        Metadata: { synthetic: "true" },
      }));
      await client.query(
        `insert into candidates (id,organization_id,display_name,external_ref) values ($1,$2,$3,$4)
         on conflict (id) do update set display_name=excluded.display_name,external_ref=excluded.external_ref,updated_at=now()`,
        [candidateId, ids.organization, candidate.name, `synthetic-${candidate.id}`],
      );
      await client.query(
        `insert into applications (id,job_id,candidate_id,stage,overall_score,review_status)
         values ($1,$2,$3,$4,$5,$6)
         on conflict (id) do update set stage=excluded.stage,overall_score=excluded.overall_score,review_status=excluded.review_status,updated_at=now()`,
        [applicationId, ids.job, candidateId, index < 3 ? "assessment" : "interview", candidate.overallScore, candidate.status === "confirmed" ? "confirmed" : "pending"],
      );
      await client.query(
        `insert into resume_documents (id,application_id,object_key,original_filename,mime_type,checksum,status,redaction_findings,page_count)
         values ($1,$2,$3,$4,'text/plain',$5,'ready',$6,1)
         on conflict (id) do update set object_key=excluded.object_key,checksum=excluded.checksum,status='ready',redaction_findings=excluded.redaction_findings,updated_at=now()`,
        [documentId, applicationId, objectKey, `合成简历-${candidate.name}.txt`, createHash("sha256").update(raw).digest("hex"),
          JSON.stringify([{ type: "phone", count: 1 }, { type: "email", count: 1 }, { type: "address", count: 1 }])],
      );
      await client.query(
        `insert into document_chunks (id,document_id,section,page,paragraph,start_offset,end_offset,redacted_text,search_text)
         values ($1,$2,'合成项目经历',1,1,0,$3,$4,$4)
         on conflict (id) do update set redacted_text=excluded.redacted_text,search_text=excluded.search_text,updated_at=now()`,
        [uuid(8, index + 1), documentId, redacted.length, redacted],
      );
      await client.query(
        `insert into interview_plans (id,application_id,skill_pack_version,rubric_version,questions,target_minutes)
         values ($1,$2,'1.4.0','finance-ai-pm-rubric-v1',$3,15)
         on conflict (id) do update set questions=excluded.questions,updated_at=now()`,
        [planId, applicationId, JSON.stringify([
          "如何识别值得做的财务 AI 场景？",
          "怎样设计 RAG 与 Agent 的评测方案？",
          "如何推动跨部门上线？",
        ])],
      );
      await client.query(
        `insert into interview_sessions (id,plan_id,token_hash,status,expires_at,started_at,completed_at,memory_summary)
         values ($1,$2,$3,$4,now()+interval '30 days',now()-interval '20 minutes',$5,$6)
         on conflict (id) do update set status=excluded.status,expires_at=excluded.expires_at,memory_summary=excluded.memory_summary,updated_at=now()`,
        [sessionId, planId, createHash("sha256").update(`synthetic-token-${index + 1}`).digest("hex"), index < 6 ? "completed" : "created",
          index < 6 ? new Date() : null, "合成面试摘要：候选人说明了场景判断、评测指标与人工确认边界。"],
      );
      if (index < 6) {
        await client.query(
          `insert into interview_turns (id,session_id,sequence,speaker,input_type,content,competency_key,is_follow_up)
           values ($1,$2,1,'candidate','text',$3,'ai',false)
           on conflict (id) do update set content=excluded.content,updated_at=now()`,
          [uuid(9, index + 1), sessionId,
            "【合成回答】我会先建立无 RAG 基线，再比较关键词、向量和混合检索，并用引用准确率和无依据结论率作为上线门槛。"],
        );
      }
    }

    const c2Application = uuid(4, 2);
    await client.query("delete from human_review_revisions where assessment_id=$1", [ids.assessment]);
    await client.query("delete from audit_events where action='assessment_human_confirmed' and object_id=$1", [ids.assessment]);
    await client.query(
      `insert into assessments (id,application_id,status,model_id,prompt_version,skill_pack_version,rubric_version,ai_scores,overall_score)
       values ($1,$2,'needs_review','deepseek-chat','assessment-v1.0.0','1.4.0','finance-ai-pm-rubric-v1',$3,82.40)
       on conflict (id) do update set status='needs_review',model_id=excluded.model_id,ai_scores=excluded.ai_scores,final_scores=null,overall_score=excluded.overall_score,confirmed_by=null,confirmed_at=null,updated_at=now()`,
      [ids.assessment, c2Application, JSON.stringify(candidates[1].scores)],
    );

    await client.query(
      `insert into eval_datasets (id,name,version,description,synthetic) values ($1,$2,'1.0.0',$3,true)
       on conflict (id) do update set name=excluded.name,description=excluded.description,synthetic=true,updated_at=now()`,
      [ids.dataset, evalRaw.name, evalRaw.notice],
    );
    for (const [index, evalCase] of evalRaw.cases.entries()) {
      const expected = evalCase.expected ?? {};
      const input = { ...evalCase };
      delete input.expected;
      await client.query(
        `insert into eval_cases (id,dataset_id,input,expected,tags) values ($1,$2,$3,$4,$5)
         on conflict (id) do update set input=excluded.input,expected=excluded.expected,tags=excluded.tags,updated_at=now()`,
        [uuid(10, index + 1), ids.dataset, JSON.stringify(input), JSON.stringify(expected), JSON.stringify([evalCase.role, evalCase.scenario, "synthetic"])],
      );
    }
    await client.query(
      `insert into audit_events (id,organization_id,actor_id,action,object_type,object_id,detail)
       values ($1,$2,$3,'synthetic_demo_seeded','demo',$4,$5)
       on conflict (id) do update set detail=excluded.detail,updated_at=now()`,
      [uuid(11, 1), ids.organization, ids.user, ids.job, JSON.stringify({ synthetic: true, candidates: candidates.length, evalCases: evalRaw.cases.length })],
    );
    await client.query("commit");
    console.log(`Synthetic demo ready: ${candidates.length} candidates, ${evalRaw.cases.length} eval cases.`);
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
