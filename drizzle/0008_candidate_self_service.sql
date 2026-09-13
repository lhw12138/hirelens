CREATE TABLE "candidate_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "candidate_matches" (
  "id" uuid PRIMARY KEY NOT NULL,
  "owner_id" uuid NOT NULL REFERENCES "candidate_accounts"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "status" text DEFAULT 'running' NOT NULL,
  "report" jsonb,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "candidate_matches_owner_idx" ON "candidate_matches" ("owner_id", "created_at");
