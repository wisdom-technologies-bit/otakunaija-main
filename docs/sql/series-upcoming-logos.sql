-- =============================================================================
-- OtakuNaija series: upcoming metadata + TMDB title logos (Prompt OTK-2)
-- Run this ONCE in the Neon SQL editor. Everything here is idempotent:
-- running it twice is harmless. No application code runs migrations.
--
-- The play service (otakunaija-play) is the only writer of most of these
-- columns; the logo pipeline (app/api/cron/series-logos) fills the tmdb_* and
-- logo_* ones. `cover_image_url` doubles as the banner image, so there is no
-- separate banner column.
-- =============================================================================

-- 1. Upcoming-release metadata -------------------------------------------------
ALTER TABLE series ADD COLUMN IF NOT EXISTS format text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS start_date date;
ALTER TABLE series ADD COLUMN IF NOT EXISTS start_year integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS start_month integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS season text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS season_year integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS popularity integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_site text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS trailer_id text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS episodes_total integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS duration_minutes integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;

-- 2. TMDB identity + cached title logo ----------------------------------------
ALTER TABLE series ADD COLUMN IF NOT EXISTS tmdb_id integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS tmdb_media text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS tmdb_season integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS imdb_id text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS logo_path text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS logo_aspect_ratio real;
ALTER TABLE series ADD COLUMN IF NOT EXISTS logo_width integer;
ALTER TABLE series ADD COLUMN IF NOT EXISTS logo_status text;
ALTER TABLE series ADD COLUMN IF NOT EXISTS logo_checked_at timestamptz;

-- tmdb_media is only ever 'tv' or 'movie'; logo_status is the pipeline's state.
DO $$
BEGIN
  ALTER TABLE series ADD CONSTRAINT series_tmdb_media_check
    CHECK (tmdb_media IS NULL OR tmdb_media IN ('tv', 'movie'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE series ADD CONSTRAINT series_logo_status_check
    CHECK (logo_status IS NULL OR logo_status IN ('found', 'none', 'error'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 3. Indexes ------------------------------------------------------------------
-- The cron's work queue: rows still waiting for a logo lookup.
CREATE INDEX IF NOT EXISTS series_logo_pending_idx
  ON series (logo_checked_at)
  WHERE logo_path IS NULL;

-- Browse / upcoming ordering by release date.
CREATE INDEX IF NOT EXISTS series_status_start_date_idx
  ON series (status, start_date);

-- 4. Admin "Import by AniList ID" log ----------------------------------------
-- The play service owns the actual request queue; this table only remembers
-- what the admin panel asked for, so the page can list the last 20 without a
-- cross-service read.
CREATE TABLE IF NOT EXISTS anime_import_log (
  id serial PRIMARY KEY,
  anilist_id integer NOT NULL,
  requested_by text,
  status text NOT NULL,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS anime_import_log_created_idx
  ON anime_import_log (created_at DESC);

DO $$
BEGIN
  ALTER TABLE anime_import_log ADD CONSTRAINT anime_import_log_status_check
    CHECK (status IN ('placeholder', 'queued', 'error'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- =============================================================================
-- Check the pipeline state after a few cron runs:
--   select coalesce(logo_status, 'not_checked'), count(*) from series group by 1;
-- =============================================================================
