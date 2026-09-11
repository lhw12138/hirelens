CREATE TABLE IF NOT EXISTS "service_heartbeats" (
  "service" text PRIMARY KEY NOT NULL,
  "status" text DEFAULT 'ok' NOT NULL,
  "details" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "last_seen" timestamptz DEFAULT now() NOT NULL
);
