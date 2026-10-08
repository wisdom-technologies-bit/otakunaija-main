CREATE TABLE IF NOT EXISTS push_events (
  id serial PRIMARY KEY,
  type text NOT NULL CHECK (type IN ('post', 'series', 'episode', 'suggestion')),
  content_id integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS push_events_type_content_unique
  ON push_events (type, content_id)
  WHERE type <> 'suggestion';

