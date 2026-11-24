-- =============================================================================
-- OtakuNaija site announcements
-- Run this ONCE in the Neon SQL editor. Everything here is idempotent:
-- running it twice is harmless. The app never runs migrations itself.
--
-- Design: the table has exactly TWO slots (1 and 2). `slot` is the primary key
-- and is constrained to (1, 2), so the database itself can never hold more than
-- two announcements. Saving a new announcement when both slots are taken
-- overwrites one slot (the admin UI picks the least recently updated one).
--
-- `targets` holds page-target keys, for example:
--   all                      every public page
--   home                     /
--   episodes                 /episodes
--   blog                     /blog
--   blog-post:*              every /blog/<slug>
--   blog-post:<slug>         one blog post
--   series:*                 every /episodes/<series-slug>
--   series:<series-slug>     one series page
--   episode:*                every /episodes/<series-slug>/<episode-slug>
--   episode-of:<series-slug> every episode page of one series
--   episode:<series-slug>/<episode-slug>   one episode page
--   page:/about              any other page by path (trailing /* = prefix match)
-- =============================================================================

CREATE TABLE IF NOT EXISTS site_announcements (
  slot          smallint     PRIMARY KEY CHECK (slot IN (1, 2)),
  title         text         CHECK (title IS NULL OR char_length(title) <= 160),
  body_markdown text         NOT NULL CHECK (char_length(body_markdown) BETWEEN 1 AND 10000),
  image_url     text         CHECK (image_url IS NULL OR char_length(image_url) <= 2000),
  cta_label     text         CHECK (cta_label IS NULL OR char_length(cta_label) <= 60),
  cta_url       text         CHECK (cta_url IS NULL OR char_length(cta_url) <= 2000),
  is_active     boolean      NOT NULL DEFAULT true,
  targets       text[]       NOT NULL DEFAULT '{}'::text[],
  -- 'page' = the full-screen cover shows once per targeted page (then the bell).
  -- 'site' = the cover shows once on the whole site (then the bell everywhere).
  seen_scope    text         NOT NULL DEFAULT 'page' CHECK (seen_scope IN ('page', 'site')),
  starts_at     timestamptz,
  ends_at       timestamptz,
  -- Bumped whenever the message content changes so visitors who already saw an
  -- older version get the full-screen cover again.
  revision      integer      NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at    timestamptz  NOT NULL DEFAULT now(),
  updated_at    timestamptz  NOT NULL DEFAULT now(),
  CONSTRAINT site_announcements_window_chk
    CHECK (starts_at IS NULL OR ends_at IS NULL OR ends_at > starts_at),
  CONSTRAINT site_announcements_cta_pair_chk
    CHECK ((cta_label IS NULL AND cta_url IS NULL) OR (cta_label IS NOT NULL AND cta_url IS NOT NULL)),
  CONSTRAINT site_announcements_targets_len_chk
    CHECK (cardinality(targets) <= 200)
);

-- Keep updated_at honest even for manual edits in the SQL editor.
CREATE OR REPLACE FUNCTION site_announcements_touch() RETURNS trigger AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS site_announcements_touch_trg ON site_announcements;
CREATE TRIGGER site_announcements_touch_trg
  BEFORE UPDATE ON site_announcements
  FOR EACH ROW EXECUTE FUNCTION site_announcements_touch();

-- Optional: a sample row so you can see it working immediately.
-- Uncomment, run, then open the site (it only shows on the home page).
--
-- INSERT INTO site_announcements (slot, title, body_markdown, cta_label, cta_url, targets)
-- VALUES (
--   1,
--   'Welcome to OtakuNaija',
--   E'We just shipped **announcements**!\n\n- Markdown works\n- So do [links](https://otakunaija.name.ng)\n\n> Enjoy the new episodes.',
--   'Browse episodes',
--   '/episodes',
--   ARRAY['home']
-- )
-- ON CONFLICT (slot) DO NOTHING;
