CREATE TABLE IF NOT EXISTS "workflow_vectors" (
 "task_id" uuid NOT NULL REFERENCES "hiring_tasks"("id") ON DELETE CASCADE,
 "candidate_id" uuid NOT NULL,
 "snapshot" text NOT NULL,
 "model_key" text NOT NULL,
 "source_id" text NOT NULL,
 "kind" text NOT NULL CHECK (kind IN ('resume','answer')),
 "embedding" vector(384) NOT NULL,
 PRIMARY KEY ("task_id","candidate_id","snapshot","model_key","source_id")
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "workflow_vectors_scope_idx" ON "workflow_vectors" ("task_id","candidate_id","snapshot","model_key","kind");
