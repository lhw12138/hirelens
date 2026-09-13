import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  vector,
} from "drizzle-orm/pg-core";
import type { HiringTask } from "@/lib/workflow";
import type { MatchReport } from '@/lib/candidate-match';

// Candidate self-service is deliberately separate from recruitment records.
export const candidateAccounts = pgTable('candidate_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const hrAccounts = pgTable('hr_accounts', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
export const hrAiUsageDaily = pgTable('hr_ai_usage_daily', {
  ownerEmail: text('owner_email').notNull().references(() => hrAccounts.email, { onDelete: 'cascade' }),
  usageDate: text('usage_date').notNull(),
  operations: integer('operations').default(0).notNull(),
}, table => [primaryKey({ name: 'hr_ai_usage_daily_pkey', columns: [table.ownerEmail, table.usageDate] })]);
export const candidateMatches = pgTable('candidate_matches', {
  id: uuid('id').primaryKey(),
  ownerId: uuid('owner_id').notNull().references(() => candidateAccounts.id, { onDelete: 'cascade' }),
  title: text('title').notNull(),
  status: text('status').notNull().default('running'),
  report: jsonb('report').$type<MatchReport>(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
}, table => [index('candidate_matches_owner_idx').on(table.ownerId, table.createdAt)]);

export const hiringTasks = pgTable("hiring_tasks", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerEmail: text("owner_email").notNull(),
  version: integer("version").default(1).notNull(),
  data: jsonb("data").$type<HiringTask>().notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("hiring_tasks_owner_idx").on(table.ownerEmail, table.updatedAt)]);

export const jobStatus = pgEnum("job_status", ["draft", "active", "closed"]);
export const workflowVectors = pgTable('workflow_vectors', {
 taskId: uuid('task_id').notNull().references(()=>hiringTasks.id,{onDelete:'cascade'}),
 candidateId: uuid('candidate_id').notNull(),
 snapshot:text('snapshot').notNull(), modelKey:text('model_key').notNull(),
 sourceId:text('source_id').notNull(),kind:text('kind').notNull(),
 embedding:vector('embedding',{dimensions:384}).notNull(),
},table=>[primaryKey({name:'workflow_vectors_pkey',columns:[table.taskId,table.candidateId,table.snapshot,table.modelKey,table.sourceId]}),index('workflow_vectors_scope_idx').on(table.taskId,table.candidateId,table.snapshot,table.modelKey,table.kind)]);
export const documentStatus = pgEnum("document_status", ["uploaded", "redaction_review", "indexing", "ready", "failed"]);
export const interviewStatus = pgEnum("interview_status", ["created", "in_progress", "completed", "expired"]);
export const assessmentStatus = pgEnum("assessment_status", ["draft", "needs_review", "confirmed"]);
export const evidenceStatus = pgEnum("evidence_status", ["grounded", "review", "missing", "conflict"]);

const timestamps = {
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
};

export const organizations = pgTable("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  ...timestamps,
});

export const serviceHeartbeats = pgTable("service_heartbeats", {
  service: text("service").primaryKey(),
  status: text("status").default("ok").notNull(),
  details: jsonb("details").default({}).notNull(),
  lastSeen: timestamp("last_seen", { withTimezone: true }).defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  passwordHash: text("password_hash").notNull(),
  name: text("name").notNull(),
  role: text("role").default("hr_admin").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("users_org_email_unique").on(table.organizationId, table.email)]);

export const skillPacks = pgTable("skill_packs", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  definition: jsonb("definition").notNull(),
  active: boolean("active").default(true).notNull(),
  ...timestamps,
});

export const jobs = pgTable("jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  skillPackId: text("skill_pack_id").references(() => skillPacks.id).notNull(),
  title: text("title").notNull(),
  department: text("department").notNull(),
  location: text("location"),
  rawDescription: text("raw_description").notNull(),
  status: jobStatus("status").default("draft").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  ...timestamps,
});

export const competencies = pgTable("competencies", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  weight: integer("weight").notNull(),
  mustHave: boolean("must_have").default(false).notNull(),
  sortOrder: integer("sort_order").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("competency_job_key_unique").on(table.jobId, table.key)]);

export const candidates = pgTable("candidates", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  displayName: text("display_name").notNull(),
  externalRef: text("external_ref"),
  ...timestamps,
});

export const applications = pgTable("applications", {
  id: uuid("id").defaultRandom().primaryKey(),
  jobId: uuid("job_id").references(() => jobs.id).notNull(),
  candidateId: uuid("candidate_id").references(() => candidates.id).notNull(),
  stage: text("stage").default("screening").notNull(),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
  reviewStatus: text("review_status").default("pending").notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("application_job_candidate_unique").on(table.jobId, table.candidateId)]);

export const resumeDocuments = pgTable("resume_documents", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").references(() => applications.id, { onDelete: "cascade" }).notNull(),
  objectKey: text("object_key").notNull(),
  originalFilename: text("original_filename").notNull(),
  mimeType: text("mime_type").notNull(),
  checksum: text("checksum").notNull(),
  status: documentStatus("status").default("uploaded").notNull(),
  redactionFindings: jsonb("redaction_findings"),
  pageCount: integer("page_count"),
  errorMessage: text("error_message"),
  ...timestamps,
});

export const documentChunks = pgTable("document_chunks", {
  id: uuid("id").defaultRandom().primaryKey(),
  documentId: uuid("document_id").references(() => resumeDocuments.id, { onDelete: "cascade" }).notNull(),
  section: text("section").notNull(),
  page: integer("page"),
  paragraph: integer("paragraph"),
  startOffset: integer("start_offset").notNull(),
  endOffset: integer("end_offset").notNull(),
  redactedText: text("redacted_text").notNull(),
  embedding: vector("embedding", { dimensions: 1024 }),
  searchText: text("search_text").notNull(),
  ...timestamps,
}, (table) => [index("document_chunks_document_idx").on(table.documentId)]);

export const interviewPlans = pgTable("interview_plans", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").references(() => applications.id).notNull(),
  skillPackVersion: text("skill_pack_version").notNull(),
  rubricVersion: text("rubric_version").notNull(),
  questions: jsonb("questions").notNull(),
  targetMinutes: integer("target_minutes").notNull(),
  ...timestamps,
});

export const interviewSessions = pgTable("interview_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  planId: uuid("plan_id").references(() => interviewPlans.id).notNull(),
  tokenHash: text("token_hash").notNull(),
  status: interviewStatus("status").default("created").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  memorySummary: text("memory_summary"),
  ...timestamps,
}, (table) => [uniqueIndex("interview_token_hash_unique").on(table.tokenHash)]);

export const interviewTurns = pgTable("interview_turns", {
  id: uuid("id").defaultRandom().primaryKey(),
  sessionId: uuid("session_id").references(() => interviewSessions.id, { onDelete: "cascade" }).notNull(),
  sequence: integer("sequence").notNull(),
  speaker: text("speaker").notNull(),
  inputType: text("input_type").default("text").notNull(),
  content: text("content").notNull(),
  competencyKey: text("competency_key"),
  isFollowUp: boolean("is_follow_up").default(false).notNull(),
  ...timestamps,
}, (table) => [uniqueIndex("interview_turn_sequence_unique").on(table.sessionId, table.sequence)]);

export const assessments = pgTable("assessments", {
  id: uuid("id").defaultRandom().primaryKey(),
  applicationId: uuid("application_id").references(() => applications.id).notNull(),
  status: assessmentStatus("status").default("draft").notNull(),
  modelId: text("model_id").notNull(),
  promptVersion: text("prompt_version").notNull(),
  skillPackVersion: text("skill_pack_version").notNull(),
  rubricVersion: text("rubric_version").notNull(),
  aiScores: jsonb("ai_scores").notNull(),
  finalScores: jsonb("final_scores"),
  overallScore: numeric("overall_score", { precision: 5, scale: 2 }),
  confirmedBy: uuid("confirmed_by").references(() => users.id),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }),
  ...timestamps,
});

export const evidenceCitations = pgTable("evidence_citations", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "cascade" }).notNull(),
  competencyId: uuid("competency_id").references(() => competencies.id).notNull(),
  chunkId: uuid("chunk_id").references(() => documentChunks.id),
  interviewTurnId: uuid("interview_turn_id").references(() => interviewTurns.id),
  claim: text("claim").notNull(),
  quote: text("quote").notNull(),
  status: evidenceStatus("status").notNull(),
  relevance: numeric("relevance", { precision: 5, scale: 4 }).notNull(),
  ...timestamps,
});

export const humanReviewRevisions = pgTable("human_review_revisions", {
  id: uuid("id").defaultRandom().primaryKey(),
  assessmentId: uuid("assessment_id").references(() => assessments.id, { onDelete: "cascade" }).notNull(),
  reviewerId: uuid("reviewer_id").references(() => users.id).notNull(),
  competencyKey: text("competency_key").notNull(),
  previousScore: numeric("previous_score", { precision: 5, scale: 2 }).notNull(),
  revisedScore: numeric("revised_score", { precision: 5, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  ...timestamps,
});

export const evalDatasets = pgTable("eval_datasets", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  version: text("version").notNull(),
  description: text("description").notNull(),
  synthetic: boolean("synthetic").default(true).notNull(),
  ...timestamps,
});

export const evalCases = pgTable("eval_cases", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => evalDatasets.id, { onDelete: "cascade" }).notNull(),
  input: jsonb("input").notNull(),
  expected: jsonb("expected").notNull(),
  tags: jsonb("tags").notNull(),
  ...timestamps,
});

export const evalRuns = pgTable("eval_runs", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => evalDatasets.id).notNull(),
  modelId: text("model_id").notNull(),
  promptVersion: text("prompt_version").notNull(),
  status: text("status").default("queued").notNull(),
  metrics: jsonb("metrics"),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const blindReviewSessions = pgTable("blind_review_sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  datasetId: uuid("dataset_id").references(() => evalDatasets.id, { onDelete: "cascade" }).notNull(),
  ownerEmail: text("owner_email").notNull(),
  reviewerRole: text("reviewer_role").default("product_owner").notNull(),
  status: text("status").default("in_progress").notNull(),
  caseIds: jsonb("case_ids").notNull(),
  answers: jsonb("answers").default({}).notNull(),
  resolutions: jsonb("resolutions").default({}).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
});

export const modelTraces = pgTable("model_traces", {
  id: uuid("id").defaultRandom().primaryKey(),
  operation: text("operation").notNull(),
  modelId: text("model_id").notNull(),
  promptVersion: text("prompt_version").notNull(),
  inputDigest: text("input_digest").notNull(),
  status: text("status").notNull(),
  latencyMs: integer("latency_ms").notNull(),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  estimatedCostCny: numeric("estimated_cost_cny", { precision: 10, scale: 5 }),
  metadata: jsonb("metadata"),
  ...timestamps,
});

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id").references(() => organizations.id).notNull(),
  actorId: uuid("actor_id").references(() => users.id),
  action: text("action").notNull(),
  objectType: text("object_type").notNull(),
  objectId: text("object_id").notNull(),
  detail: jsonb("detail").notNull(),
  ...timestamps,
});

export const backgroundJobs = pgTable("background_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  type: text("type").notNull(),
  payload: jsonb("payload").notNull(),
  idempotencyKey: text("idempotency_key").notNull(),
  status: text("status").default("queued").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  runAfter: timestamp("run_after", { withTimezone: true }).defaultNow().notNull(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  ...timestamps,
}, (table) => [uniqueIndex("background_jobs_idempotency_unique").on(table.idempotencyKey), index("background_jobs_claim_idx").on(table.status, table.runAfter, table.createdAt)]);
