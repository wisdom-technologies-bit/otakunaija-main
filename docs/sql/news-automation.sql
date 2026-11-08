-- =============================================================================
-- OtakuNaija automated anime news (Prompt N1)
-- Run this ONCE in the Neon SQL editor before enabling the cron job.
-- Everything here is idempotent: running it twice is harmless.
-- The cron route never runs migrations itself.
-- =============================================================================

-- 1. Provenance columns on the blog posts table ------------------------------

ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_name text;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS source_url text;

-- One post per source article. Partial so the many hand-written posts with a
-- NULL source_url keep working exactly as before.
CREATE UNIQUE INDEX IF NOT EXISTS posts_source_url_unique
  ON posts (source_url)
  WHERE source_url IS NOT NULL;

-- 2. Ingestion queue ---------------------------------------------------------
-- The original article's full text is deliberately NOT stored here: only the
-- feed metadata (title, link, date, image, topics) plus the rewritten JSON.
-- The article body is fetched in memory during the run and then discarded.

CREATE TABLE IF NOT EXISTS news_ingest (
  id                    serial PRIMARY KEY,
  guid                  text NOT NULL UNIQUE,
  source_url            text NOT NULL,
  source_name           text DEFAULT 'Anime News Network',
  original_title        text,
  original_published_at timestamptz,
  image_url             text,
  topics                text[],
  status                text NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'rewritten', 'published', 'skipped', 'failed')),
  attempts              int NOT NULL DEFAULT 0,
  last_error            text,
  rewritten             jsonb,
  post_id               int,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS news_ingest_status_created_idx
  ON news_ingest (status, created_at);

-- Lookup used by the admin automation tab and the cron's "remaining" count.
CREATE INDEX IF NOT EXISTS news_ingest_post_id_idx
  ON news_ingest (post_id)
  WHERE post_id IS NOT NULL;

-- 3. Sanity check (optional, read-only) --------------------------------------
-- SELECT status, count(*) FROM news_ingest GROUP BY status ORDER BY status;
