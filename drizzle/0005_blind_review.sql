CREATE TABLE blind_review_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dataset_id uuid NOT NULL REFERENCES eval_datasets(id) ON DELETE CASCADE,
  owner_email text NOT NULL,
  reviewer_role text NOT NULL DEFAULT 'product_owner',
  status text NOT NULL DEFAULT 'in_progress',
  case_ids jsonb NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX blind_review_sessions_owner_idx ON blind_review_sessions(owner_email, dataset_id, created_at DESC);
