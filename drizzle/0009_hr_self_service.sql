CREATE TABLE "hr_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "email" text NOT NULL UNIQUE,
  "password_hash" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hr_ai_usage_daily" (
  "owner_email" text NOT NULL REFERENCES "hr_accounts"("email") ON DELETE CASCADE,
  "usage_date" text NOT NULL,
  "operations" integer DEFAULT 0 NOT NULL,
  CONSTRAINT "hr_ai_usage_daily_pkey" PRIMARY KEY("owner_email", "usage_date")
);
