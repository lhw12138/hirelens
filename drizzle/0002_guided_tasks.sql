CREATE TABLE "hiring_tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "owner_email" text NOT NULL,
  "version" integer DEFAULT 1 NOT NULL,
  "data" jsonb NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
CREATE INDEX "hiring_tasks_owner_idx" ON "hiring_tasks" ("owner_email", "updated_at");
