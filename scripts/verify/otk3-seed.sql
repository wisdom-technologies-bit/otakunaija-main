TRUNCATE episodes, series, creators RESTART IDENTITY CASCADE;

INSERT INTO creators (name, slug, bio) VALUES
  ('Naija Animation Studio', 'naija-animation-studio', 'Lagos-based animation studio.'),
  ('Kano Frame Works', 'kano-frame-works', 'Northern Nigeria animation collective.');

INSERT INTO series (creator_id, title, slug, synopsis, cover_image_url, poster_image_url, status, genre, format, season, season_year, start_date, episodes_total, duration_minutes, trailer_site, trailer_id, is_placeholder, logo_path, logo_aspect_ratio, logo_width, logo_status, logo_checked_at, created_at)
VALUES
  (1, 'Aurora Line', 'aurora-line',
   'When the northern lights crack open above Lagos, a courier with a stolen star map has three nights to return it before the sky goes dark for good. A slow-burn adventure about debt, loyalty and very fast trains.',
   '/seed/banner-1.svg', '/seed/poster-1.svg', 'ongoing', 'Action, Fantasy, Adventure', 'TV', 'fall', 2026, '2026-10-02', 24, 24, 'youtube', 'dQw4w9WgXcQ', false,
   '/auroraline.png', 3.2, 1000, 'found', now(), now() - interval '40 days'),
  (1, 'Midnight Courier', 'midnight-courier',
   'A night-shift bike messenger falls for the stranger who keeps sending letters she can never deliver. Ten episodes, one city, and a lot of rain.',
   '/seed/banner-2.svg', '/seed/poster-2.svg', 'ongoing', 'Romance, Drama', 'TV', 'summer', 2026, '2026-08-14', 10, 22, NULL, NULL, false,
   NULL, NULL, NULL, 'none', now(), now() - interval '80 days'),
  (2, 'Starfall Protocol', 'starfall-protocol',
   'A dormant satellite wakes up over the Sahel and starts broadcasting instructions nobody wrote. The follow-up to the 2024 short film, arriving 2027.',
   '/seed/banner-3.svg', '/seed/poster-3.svg', 'upcoming', 'Sci-Fi, Action, Mystery', 'TV', 'winter', 2027, '2027-03-12', 12, 24, 'youtube', 'dQw4w9WgXcQ', true,
   '/starfall.png', 3.5, 1100, 'found', now(), now() - interval '12 days'),
  (1, 'Grand Odyssey', 'grand-odyssey',
   'Four hundred years of a family that refuses to leave its island, told in one hundred and twenty episodes.',
   '/seed/banner-4.svg', '/seed/poster-4.svg', 'completed', 'Action, Adventure', 'TV', 'spring', 2019, '2019-04-06', 120, 24, NULL, NULL, false,
   NULL, NULL, NULL, 'none', now(), now() - interval '2000 days'),
  (2, 'Ember Saga', 'ember-saga',
   'A blacksmith inherits a forge that remembers every weapon it ever made.',
   '/seed/banner-5.svg', '/seed/poster-5.svg', 'ongoing', 'Action, Fantasy', 'TV', 'fall', 2026, '2026-09-20', 16, 24, NULL, NULL, false,
   NULL, NULL, NULL, 'none', now(), now() - interval '60 days'),
  (1, 'Quiet Town', 'quiet-town',
   'Nothing happens in Igboho. That is the problem.',
   '/seed/banner-2.svg', '/seed/poster-2.svg', 'ongoing', 'Romance, Slice of Life', 'TV', 'spring', 2026, '2026-04-01', 12, 22, NULL, NULL, false,
   NULL, NULL, NULL, 'none', now(), now() - interval '120 days');

-- Aurora Line: 12 episodes, newest 5 hours old (drives the New chip)
INSERT INTO episodes (series_id, episode_number, title, slug, synopsis, video_url, thumbnail_url, duration_seconds, subtitles_url, published_at, view_count, total_watch_minutes)
SELECT 1, n, 'The Sky Over Yaba ' || n, 'aurora-line-ep-' || n,
  'Episode ' || n || ' of Aurora Line: the courier network closes in as the map starts rewriting itself.',
  'https://example.com/aurora-' || n || '.m3u8', '/seed/thumb-' || ((n % 6) + 1) || '.svg', 1440,
  'https://example.com/aurora-' || n || '.vtt',
  now() - ((13 - n) * interval '7 days') + interval '12 hours', 900 - n * 37, 640 - n * 12
FROM generate_series(1, 12) AS n;

-- Midnight Courier: 8 episodes, 3 days old
INSERT INTO episodes (series_id, episode_number, title, slug, published_at, video_url, thumbnail_url, duration_seconds, view_count, total_watch_minutes)
SELECT 2, n, 'Rain, Again ' || n, 'midnight-courier-ep-' || n,
  now() - ((8 - n) * interval '7 days') - interval '3 days',
  'https://example.com/courier-' || n || '.m3u8', '/seed/thumb-' || ((n % 6) + 1) || '.svg', 1320, 700 - n * 21, 400
FROM generate_series(1, 8) AS n;

-- Grand Odyssey: 120 episodes for the range selector
INSERT INTO episodes (series_id, episode_number, title, slug, published_at, video_url, thumbnail_url, duration_seconds, view_count, total_watch_minutes)
SELECT 4, n, 'Voyage ' || n, 'grand-odyssey-ep-' || n,
  now() - ((121 - n) * interval '7 days'),
  'https://example.com/odyssey-' || n || '.m3u8', '/seed/thumb-' || ((n % 6) + 1) || '.svg', 1440, 500 - n, 200
FROM generate_series(1, 120) AS n;

INSERT INTO episodes (series_id, episode_number, title, slug, published_at, video_url, thumbnail_url, duration_seconds, view_count, total_watch_minutes)
SELECT 5, n, 'The Forge ' || n, 'ember-saga-ep-' || n,
  now() - ((17 - n) * interval '7 days'),
  'https://example.com/ember-' || n || '.m3u8', '/seed/thumb-' || ((n % 6) + 1) || '.svg', 1440, 1200 - n * 10, 300
FROM generate_series(1, 16) AS n;

INSERT INTO episodes (series_id, episode_number, title, slug, published_at, video_url, thumbnail_url, duration_seconds, view_count, total_watch_minutes)
SELECT 6, n, 'Market Day ' || n, 'quiet-town-ep-' || n,
  now() - ((13 - n) * interval '7 days'),
  'https://example.com/quiet-' || n || '.m3u8', '/seed/thumb-' || ((n % 6) + 1) || '.svg', 1320, 600 - n * 5, 150
FROM generate_series(1, 12) AS n;

UPDATE series SET status = status;


-- The newest episode on purpose lands a few hours ago, so the "New" chip
-- (72h window) is exercised on both the hero and the series page.
UPDATE episodes SET published_at = now() - interval '5 hours' WHERE series_id = 1 AND episode_number = 12;
