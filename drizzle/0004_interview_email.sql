CREATE TABLE email_settings (
  owner_email text PRIMARY KEY,
  smtp_host text NOT NULL,
  smtp_port integer NOT NULL,
  smtp_secure boolean NOT NULL,
  smtp_username text NOT NULL,
  smtp_password_ciphertext text NOT NULL,
  from_email text NOT NULL,
  display_name text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE interview_notices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES hiring_tasks(id) ON DELETE CASCADE,
  candidate_id uuid NOT NULL,
  content_key text NOT NULL UNIQUE,
  recipient_ciphertext text NOT NULL,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX interview_notices_task_idx ON interview_notices(task_id, candidate_id, created_at);
