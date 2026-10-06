ALTER TABLE episodes ALTER COLUMN published_at TYPE timestamptz USING published_at AT TIME ZONE 'UTC';
ALTER TABLE episodes ALTER COLUMN published_at SET DEFAULT now();
