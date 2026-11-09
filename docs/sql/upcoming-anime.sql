-- =============================================================================
-- OtakuNaija upcoming anime cache (Prompt N2)
-- Run this ONCE in the Neon SQL editor. Everything here is idempotent:
-- running it twice is harmless. The cron route never runs migrations itself.
--
-- Nothing here is about users: these tables only cache public AniList data.
-- =============================================================================

-- 1. Cached AniList media -----------------------------------------------------
-- One row per AniList media id. Partial dates are preserved three ways:
--   * start_date  -> only when AniList knows year + month + day
--   * start_year / start_month / start_day -> whatever AniList actually has
-- so "January 2027" and "TBA" never get invented into a fake day.

CREATE TABLE IF NOT EXISTS upcoming_anime (
  anilist_id integer PRIMARY KEY,
  mal_id integer,
  title_romaji text,
  title_english text,
  title_native text,
  cover_url text,
  cover_color text,
  banner_url text,
  format text,
  status text,
  season text,
  season_year integer,
  start_date date,
  start_year integer,
  start_month integer,
  start_day integer,
  episodes integer,
  duration integer,
  genres text[],
  studio text,
  description text,
  popularity integer,
  trailer_site text,
  trailer_id text,
  source text,
  country text,
  site_url text,
  next_airing_episode integer,
  next_airing_at timestamptz,
  is_adult boolean NOT NULL DEFAULT false,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS upcoming_anime_next_airing_idx
  ON upcoming_anime (next_airing_at);

CREATE INDEX IF NOT EXISTS upcoming_anime_season_idx
  ON upcoming_anime (season_year, season);

CREATE INDEX IF NOT EXISTS upcoming_anime_start_date_idx
  ON upcoming_anime (start_date);

CREATE INDEX IF NOT EXISTS upcoming_anime_popularity_idx
  ON upcoming_anime (popularity DESC);

-- 2. Episode air times --------------------------------------------------------
-- The next 8 days of air times for the anime we know about. (anilist_id,
-- episode) is the natural key so re-fetching the same window is a no-op.

CREATE TABLE IF NOT EXISTS airing_schedule (
  anilist_id integer NOT NULL,
  episode integer NOT NULL,
  airing_at timestamptz NOT NULL,
  PRIMARY KEY (anilist_id, episode)
);

CREATE INDEX IF NOT EXISTS airing_schedule_airing_at_idx
  ON airing_schedule (airing_at);
