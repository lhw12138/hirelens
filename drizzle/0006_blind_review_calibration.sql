ALTER TABLE blind_review_sessions ADD COLUMN resolutions jsonb NOT NULL DEFAULT '{}'::jsonb;
