-- =============================================================================
-- OtakuNaija daily morning newsletter (Prompt N3)
-- Run this ONCE in the Neon SQL editor before enabling the cron jobs.
-- Everything here is idempotent: running it twice is harmless.
-- The app never runs migrations itself.
-- =============================================================================

-- 1. Subscribers: double opt-in state, tokens and preferences ----------------
-- The table already existed with (id, email, subscribed_at) and was written to
-- by app/actions/newsletter.ts. Every column below is added if missing.

ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active';
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS source text;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS prefs jsonb NOT NULL
  DEFAULT '{"news": true, "episodes": true, "upcoming": true, "frequency": "daily"}'::jsonb;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS last_sent_at timestamptz;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS last_issue_id int;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS unsubscribe_reason text;
ALTER TABLE subscribers ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- Tokens for the confirm / unsubscribe / preferences links. Existing rows get
-- one immediately; new rows get one from the column default.
ALTER TABLE subscribers ALTER COLUMN token SET DEFAULT replace(gen_random_uuid()::text, '-', '');
UPDATE subscribers SET token = replace(gen_random_uuid()::text, '-', '') WHERE token IS NULL;
ALTER TABLE subscribers ALTER COLUMN token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS subscribers_token_key ON subscribers (token);
CREATE UNIQUE INDEX IF NOT EXISTS subscribers_email_key ON subscribers (lower(email));

-- Legacy rows (inserted before this migration) were never confirmed but were
-- receiving nothing, so they are grandfathered in as active rather than
-- dropped. The WHERE clause keeps this safe to re-run: it only ever touches
-- rows that still look legacy.
UPDATE subscribers
SET status = 'active', source = 'legacy'
WHERE source IS NULL
  AND confirmed_at IS NULL
  AND status = 'active';

UPDATE subscribers
SET created_at = COALESCE(subscribed_at, now())
WHERE created_at IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'subscribers_status_check'
  ) THEN
    ALTER TABLE subscribers ADD CONSTRAINT subscribers_status_check
      CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced', 'complained'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS subscribers_status_idx ON subscribers (status);
-- Fair-queue order for the daily cap: oldest last_sent_at first.
CREATE INDEX IF NOT EXISTS subscribers_last_sent_idx ON subscribers (last_sent_at ASC NULLS FIRST);

-- 2. One row per calendar day (Africa/Lagos issue date) ----------------------
-- payload is the content SELECTION only (ids, slugs, metadata and the copy),
-- never HTML: HTML is rendered at send time per preferences combination.

CREATE TABLE IF NOT EXISTS newsletter_issues (
  id            serial PRIMARY KEY,
  issue_date    date NOT NULL UNIQUE,
  status        text NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'approved', 'sending', 'sent', 'skipped', 'failed')),
  layout        text,
  subject       text,
  preheader     text,
  editors_note  text,
  payload       jsonb,
  html_size     int,
  recipients    int NOT NULL DEFAULT 0,
  sent          int NOT NULL DEFAULT 0,
  failed        int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  approved_at   timestamptz,
  sent_at       timestamptz,
  error         text
);

CREATE INDEX IF NOT EXISTS newsletter_issues_status_idx ON newsletter_issues (status, issue_date DESC);

-- 3. Deliverability / engagement events from the Brevo webhook ---------------
-- The unique key dedupes webhook retries. coalesce(url,'') is required because
-- NULL never compares equal in a unique index, and click events are per-URL.

CREATE TABLE IF NOT EXISTS newsletter_events (
  id                bigserial PRIMARY KEY,
  issue_id          int REFERENCES newsletter_issues (id) ON DELETE SET NULL,
  subscriber_id     int,
  event             text NOT NULL,
  url               text,
  occurred_at       timestamptz,
  brevo_message_id  text
);

CREATE UNIQUE INDEX IF NOT EXISTS newsletter_events_dedupe_key
  ON newsletter_events (brevo_message_id, event, coalesce(url, ''));

CREATE INDEX IF NOT EXISTS newsletter_events_issue_event_idx
  ON newsletter_events (issue_id, event);

CREATE INDEX IF NOT EXISTS newsletter_events_subscriber_idx
  ON newsletter_events (subscriber_id, occurred_at DESC);

-- 4. Small key/value settings table (paused switch lives here) ---------------

CREATE TABLE IF NOT EXISTS newsletter_settings (
  key   text PRIMARY KEY,
  value text
);

INSERT INTO newsletter_settings (key, value)
VALUES ('paused', 'false')
ON CONFLICT (key) DO NOTHING;

-- 5. Sanity checks (optional, read-only) ------------------------------------
-- SELECT status, count(*) FROM subscribers GROUP BY status ORDER BY status;
-- SELECT issue_date, status, layout, subject, sent, failed FROM newsletter_issues ORDER BY issue_date DESC LIMIT 14;
-- SELECT event, count(*) FROM newsletter_events GROUP BY event ORDER BY 2 DESC;
