# OtakuNaija technical report

**Scope.** Read-only audit of the checkout and the connected Neon database for `otakunaija.name.ng`, performed 2026-10-14. No application code or database objects were changed. Secret values are intentionally omitted; environment-variable names only are listed.

## 1. Stack

- **Framework:** Next.js `16.2.4` (`package.json`), App Router under `app/`.
- **Runtime:** Next.js server routes/server actions; no route explicitly exports `runtime = 'edge'`, so database code is Node-oriented.
- **Hosting:** Vercel project `prj_Q8PJxwZXfUvh3cRoMWVGNxMe8JtV`; custom domain supplied by the requester.
- **React:** `19.2.4`; TypeScript `5.7.3`.
- **Database:** Neon Postgres, database `neondb`, active compute in `aws-us-east-1`.
- **ORM/drivers:** `drizzle-orm` `0.45.2`; `@neondatabase/serverless` `1.1.0`; `drizzle-kit` `0.31.10`. The app uses both a Drizzle Neon driver and a direct tagged-template Neon client:
  - `/vercel/share/v0-project/lib/db/index.ts`: `Pool` from `@neondatabase/serverless`, `drizzle(pool, { schema })`, connection env var `DATABASE_URL`.
  - `/vercel/share/v0-project/lib/db.ts`: lazy `neon(process.env.DATABASE_URL)` tagged-template client.
  - `/vercel/share/v0-project/drizzle.config.ts`: Drizzle Kit PostgreSQL config, schema `./lib/db/schema.ts`, migrations `./lib/db/migrations`, `DATABASE_URL`.
- **Pooling:** code does not select a separate pooled/direct variable. It passes `DATABASE_URL` to `@neondatabase/serverless`; the env inventory also contains `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, and related aliases, but no source file inspected selects them. The Neon endpoint metadata reports pooling disabled for the connected endpoint, so this is not currently a `-pooler` connection in practice.

## 2. Live Neon schema

### Required catalog queries and real outputs

The following were executed against the live Neon database. The first query returned **3,031 catalog-result lines** (all columns), the `pg_indexes` query returned **446 lines**, and the constraint query returned **2,272 lines**. The complete raw tool captures are retained at:

- `user_read_only_context/tool_content/reading-live-columns-neon-run-sql-hmr-t.txt`
- `user_read_only_context/tool_content/reading-live-indexes-neon-run-sql-x-zs-c.txt`
- `user_read_only_context/tool_content/reading-live-constraints-neon-run-sql-ivbq.txt`

```sql
SELECT table_schema, table_name, column_name, ordinal_position,
       data_type, udt_name, is_nullable, column_default,
       character_maximum_length, numeric_precision, numeric_scale
FROM information_schema.columns
WHERE table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY table_schema, table_name, ordinal_position;
```

Observed output begins:

```text
{"table_schema":"drizzle","table_name":"__drizzle_migrations","column_name":"id","data_type":"integer","is_nullable":"NO","column_default":"nextval('drizzle.__drizzle_migrations_id_seq'::regclass)"}
{"table_schema":"drizzle","table_name":"__drizzle_migrations","column_name":"hash","data_type":"text","is_nullable":"NO","column_default":null}
{"table_schema":"drizzle","table_name":"__drizzle_migrations","column_name":"created_at","data_type":"bigint","is_nullable":"YES","column_default":null}
{"table_schema":"public","table_name":"activated_posts","column_name":"slug","data_type":"text","is_nullable":"NO","column_default":null}
```

```sql
SELECT schemaname, tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname NOT IN ('pg_catalog','information_schema')
ORDER BY schemaname, tablename, indexname;
```

Observed output includes:

```text
public.activated_posts_pkey
CREATE UNIQUE INDEX activated_posts_pkey ON public.activated_posts USING btree (slug)
public.anime_match_candidates_series_id_unique
CREATE UNIQUE INDEX anime_match_candidates_series_id_unique ON public.anime_match_candidates USING btree (series_id)
public.episodes_pkey
CREATE UNIQUE INDEX episodes_pkey ON public.episodes USING btree (id)
public.episodes_play_id_unique
CREATE UNIQUE INDEX episodes_play_id_unique ON public.episodes USING btree (play_id)
public.episodes_slug_key
CREATE UNIQUE INDEX episodes_slug_key ON public.episodes USING btree (slug)
```

```sql
SELECT tc.table_schema, tc.table_name, tc.constraint_name,
       tc.constraint_type, kcu.column_name,
       ccu.table_schema AS foreign_table_schema,
       ccu.table_name AS foreign_table_name,
       ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.key_column_usage kcu
  ON tc.constraint_schema=kcu.constraint_schema
 AND tc.constraint_name=kcu.constraint_name
 AND tc.table_schema=kcu.table_schema
 AND tc.table_name=kcu.table_name
LEFT JOIN information_schema.constraint_column_usage ccu
  ON tc.constraint_schema=ccu.constraint_schema
 AND tc.constraint_name=ccu.constraint_name
WHERE tc.table_schema NOT IN ('pg_catalog','information_schema')
ORDER BY tc.table_schema, tc.table_name, tc.constraint_name, kcu.ordinal_position;
```

Observed live `episodes` constraint output:

```text
episodes_pkey             PRIMARY KEY (id)
episodes_play_id_unique   UNIQUE (play_id)
episodes_series_id_fkey  FOREIGN KEY (series_id) REFERENCES series(id)
episodes_slug_key         UNIQUE (slug)
```

### Application-defined public tables and exact columns

The source-of-truth application declarations are `/vercel/share/v0-project/lib/db/schema.ts`. Live catalog inspection shows schema drift: live public tables include tables not declared in that file, including `comment_anchors`, `comment_reactions`, `comment_reports`, `commenters`, and other legacy objects. The declared tables and exact definitions are:

- `creators`: `id serial/int4 NOT NULL DEFAULT nextval(...) PRIMARY KEY`; `name text NOT NULL`; `slug text NOT NULL UNIQUE`; `bio text NULL`; `avatar_url text NULL`; `facebook_url text NULL`; `created_at timestamp NULL DEFAULT now()`.
- `series`: `id serial/int4 NOT NULL DEFAULT nextval(...) PRIMARY KEY`; `creator_id integer NOT NULL REFERENCES creators(id)`; `title text NOT NULL`; `slug text NOT NULL UNIQUE`; `synopsis text NULL`; `cover_image_url text NULL`; `poster_image_url text NULL`; `status text NULL DEFAULT 'ongoing'`; `genre text NULL`; `anilist_id integer NULL UNIQUE`; `title_checked boolean NOT NULL DEFAULT false`; `animeschedule_slug text NULL UNIQUE`; `animeschedule_data jsonb NULL`; `animeschedule_synced_at timestamp with time zone NULL`; `created_at timestamp NULL DEFAULT now()`.
- `videos`: `id serial/int4 NOT NULL PRIMARY KEY`; `title text NOT NULL`; `slug text NOT NULL UNIQUE`; `content_type text NOT NULL`; `synopsis text NULL`; `poster_image_url text NULL`; `cover_image_url text NULL`; `thumbnail_url text NOT NULL`; `creator_id integer NULL REFERENCES creators(id)`; `parent_series_id integer NULL REFERENCES series(id)`; `genre text NULL`; `status text NULL`; `duration_seconds integer NULL`; `video_public_id text NULL`; `video_url text NULL`; `subtitles_url text NULL`; `play_id text NULL UNIQUE`; `anilist_id integer NULL UNIQUE`; `mal_id integer NULL`; `published_at timestamp with time zone NOT NULL DEFAULT now()`; `view_count integer NULL DEFAULT 0`; `total_watch_minutes integer NULL DEFAULT 0`.
- `episodes`: `id serial/int4 NOT NULL PRIMARY KEY`; `series_id integer NOT NULL REFERENCES series(id)`; `episode_number integer NOT NULL`; `title text NOT NULL`; `slug text NOT NULL UNIQUE`; `synopsis text NULL`; `video_public_id text NULL`; `video_url text NULL`; `thumbnail_url text NOT NULL`; `duration_seconds integer NULL`; `subtitles_url text NULL`; `play_id text NULL UNIQUE`; `published_at timestamp with time zone NOT NULL DEFAULT now()`; `view_count integer NULL DEFAULT 0`; `total_watch_minutes integer NULL DEFAULT 0`.
- `post_views`: `id serial/int4 NOT NULL PRIMARY KEY`; `post_id integer NOT NULL`; `device_id text NOT NULL`; `viewed_at timestamp NULL DEFAULT now()`; indexes declared: `post_views_post_viewed_at_idx(post_id, viewed_at)`, `post_views_viewed_at_idx(viewed_at)`.
- `episode_views`: `id serial/int4 NOT NULL PRIMARY KEY`; `episode_id integer NOT NULL REFERENCES episodes(id)`; `device_id text NOT NULL`; `viewed_at timestamp NULL DEFAULT now()`; unique `episode_views_episode_device_unique(episode_id, device_id)`.
- `episode_watch_pings`: `id serial/int4 NOT NULL PRIMARY KEY`; `episode_id integer NOT NULL REFERENCES episodes(id)`; `device_id text NOT NULL`; `minutes_watched integer NOT NULL DEFAULT 1`; `last_ping_at timestamp NULL DEFAULT now()`; unique `episode_watch_pings_episode_device_unique(episode_id, device_id)`.
- `comment_users`: `id serial/int4 NOT NULL PRIMARY KEY`; `email text NOT NULL UNIQUE`; `name text NULL`; `username text NOT NULL UNIQUE`; `token text NOT NULL UNIQUE`; `created_at timestamp NULL DEFAULT now()`.
- `comments`: `id serial/int4 NOT NULL PRIMARY KEY`; `post_slug text NOT NULL`; `parent_id integer NULL`; `user_id integer NOT NULL REFERENCES comment_users(id)`; `body text NOT NULL`; `likes integer NULL DEFAULT 0`; `created_at timestamp NULL DEFAULT now()`.
- `text_annotations`: `id serial/int4 NOT NULL PRIMARY KEY`; `post_slug text NOT NULL`; `selected_text text NULL`; `context_hash text NULL`; `start_offset integer NULL`; `end_offset integer NULL`; `comment_id integer NULL REFERENCES comments(id) ON DELETE CASCADE`; `created_at timestamp NULL DEFAULT now()`.
- `reactions`: `id serial/int4 NOT NULL PRIMARY KEY`; `comment_id integer NOT NULL REFERENCES comments(id) ON DELETE CASCADE`; `user_id integer NOT NULL REFERENCES comment_users(id)`; `type text NOT NULL`; `created_at timestamp NULL DEFAULT now()`; unique `(comment_id,user_id,type)`.
- `comment_likes`: `comment_id integer NOT NULL REFERENCES comments(id)`; `user_id integer NOT NULL REFERENCES comment_users(id)`; unique `(comment_id,user_id)`; no declared surrogate primary key.
- `activated_posts`: `slug text NOT NULL PRIMARY KEY`; `activated_at timestamp NULL DEFAULT now()`.
- `polls`: `id serial/int4 NOT NULL PRIMARY KEY`; `title text NOT NULL`; `slug text NOT NULL UNIQUE`; `description text NULL`; `status text NOT NULL DEFAULT 'DRAFT'`; `featured boolean NOT NULL DEFAULT false`; `allow_multiple_votes boolean NOT NULL DEFAULT false`; `starts_at timestamp NULL`; `ends_at timestamp NULL`; `created_at timestamp NOT NULL DEFAULT now()`; `updated_at timestamp NOT NULL DEFAULT now()`; index `polls_status_idx(status)`.
- `poll_options`: `id serial/int4 NOT NULL PRIMARY KEY`; `poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE`; `label text NOT NULL`; `description text NULL`; `image_url text NULL`; `image_public_id text NULL`; `display_order integer NOT NULL DEFAULT 0`; `is_active boolean NOT NULL DEFAULT true`; `created_at timestamp NOT NULL DEFAULT now()`; `updated_at timestamp NOT NULL DEFAULT now()`; index `(poll_id,display_order)`.
- `rate_limits`: `id serial/int4 NOT NULL PRIMARY KEY`; `identifier text NOT NULL`; `action text NOT NULL`; `count integer NULL DEFAULT 1`; `window_start timestamp NULL DEFAULT now()`; unique `(identifier,action)`.
- `poll_votes`: `id serial/int4 NOT NULL PRIMARY KEY`; `poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE`; `option_id integer NOT NULL REFERENCES poll_options(id) ON DELETE CASCADE`; `voter_hash text NOT NULL`; `country_code text NULL`; `country_name text NULL`; `region text NULL`; `city text NULL`; `timezone text NULL`; `continent text NULL`; `device_type text NULL`; `user_agent_hash text NULL`; `referrer text NULL`; `voted_at timestamp NOT NULL DEFAULT now()`; unique `(poll_id,voter_hash,option_id)`; index `(poll_id,voted_at)`.
- `poll_views`: `id serial/int4 NOT NULL PRIMARY KEY`; `poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE`; `device_id text NOT NULL`; `source text NULL`; `source_article_id integer NULL`; `viewed_at timestamp NOT NULL DEFAULT now()`; index `(poll_id,viewed_at)`.
- `poll_vote_submissions`: `id serial/int4 NOT NULL PRIMARY KEY`; `poll_id integer NOT NULL REFERENCES polls(id) ON DELETE CASCADE`; `voter_hash text NOT NULL`; `submitted_at timestamp NOT NULL DEFAULT now()`; unique `(poll_id,voter_hash)`.
- `anime_match_candidates`: `id serial/int4 NOT NULL PRIMARY KEY`; `series_id integer NOT NULL REFERENCES series(id)`; `candidate_anilist_id integer NOT NULL`; `candidate_title text NOT NULL`; `conflict_series_id integer NULL REFERENCES series(id)`; `conflict_reason text NULL`; `status text NOT NULL DEFAULT 'pending'`; `created_at timestamp NULL DEFAULT now()`; unique `series_id`.
- `push_events`: `id serial/int4 NOT NULL PRIMARY KEY`; `type text NOT NULL`; `content_id integer NOT NULL`; `status text NOT NULL DEFAULT 'pending'`; `attempts integer NOT NULL DEFAULT 0`; `last_error text NULL`; `created_at timestamp with time zone NOT NULL DEFAULT now()`; `sent_at timestamp with time zone NULL`; partial unique index `(type,content_id) WHERE type <> 'suggestion'`.

Live-only/legacy tables must not be inferred from `schema.ts`; the live `information_schema.columns` capture is authoritative for their exact columns. This is a material migration/schema-drift risk and should be resolved before generating a new search migration.

### Relationships

```text
creators 1 ──< series 1 ──< episodes
creators 1 ──< videos >── 0..1 series (videos.parent_series_id)
series 1 ──< anime_match_candidates (series_id)
series 0..1 ──< anime_match_candidates (conflict_series_id)
episodes 1 ──< episode_views
episodes 1 ──< episode_watch_pings
comment_users 1 ──< comments 1 ──< text_annotations
comments 1 ──< reactions / comment_likes
polls 1 ──< poll_options 1 ──< poll_votes
polls 1 ──< poll_views / poll_vote_submissions
```

There is no `users` table in the declared app schema. The user-like table for comments is `comment_users`; the live database also contains legacy `commenters` and related tables.

## 3. Anime/series specifics

- The application calls anime records `series`, not `anime`; internal key is `series.id` (`integer`), AniList ID is `series.anilist_id` (`integer`, nullable, **unique btree index**). MAL ID exists only on `videos.mal_id` (`integer`, nullable); there is no `series.mal_id` in the declared schema.
- `series.status` is nullable text with default `'ongoing'`. The live query output was:

```text
status     count
completed  2
ongoing    186
```

No `upcoming` value exists in the current data. Code nevertheless accepts `upcoming` as a pagination filter in `/vercel/share/v0-project/lib/db/queries.ts`; `/vercel/share/v0-project/app/actions/admin.ts` only types create/update status as `ongoing | completed`.
- The Play ingestion route maps `currently airing -> ongoing`, `finished airing -> completed`, `not yet aired -> ongoing`; therefore not-yet-released records are currently represented as `ongoing`, not `upcoming`.
- No `next_airing_episode`, `total_episodes`, or air-date column exists on `series`. AnimeSchedule metadata is stored in nullable `animeschedule_data jsonb` plus `animeschedule_synced_at timestamptz`; release timing for episodes is `episodes.published_at timestamptz`.
- `series.anilist_id` is unique and indexed. It is nullable, so PostgreSQL permits multiple NULLs. `animeschedule_slug` is also nullable unique.
- The source declares no triggers or generated columns. No application view is relied upon for this feature; the attempted live view query had a branch typo and should be rerun before any schema migration. No nullable-column addition is blocked by a declared trigger, but the live/schema drift must be reconciled first.

## 4. Episodes specifics

- Episodes link through `episodes.series_id integer NOT NULL REFERENCES series(id)`, never directly through AniList ID.
- Episode number is `episodes.episode_number integer NOT NULL`.
- There is **no unique constraint on `(series_id, episode_number)`**. Only `id`, `slug`, and nullable `play_id` are constrained. Duplicate episode numbers for a series are therefore possible.
- The gap query returned examples including:

```text
series 6  Welcome to Demon School! Iruma-kun Season 4  17 -> 24
series 7  Ascendance of a Bookworm: Adopted Daughter of an Archduke  15 -> 23
series 8  MAO  17 -> 26
series 10 The Ogre's Bride 1 -> 3
series 16 Sparks of Tomorrow 4 -> 13
```

- The zero-episode query returned `anime_with_zero_episodes = 6`.
- “Latest episode” is computed, not stored: `/vercel/share/v0-project/lib/db/queries.ts` function `getLatestEpisodeNumber(seriesId)` uses `MAX(episodes.episodeNumber)`; `/vercel/share/v0-project/lib/db/queries.ts` function `getTopSeriesByGenre` also selects `MAX(episodes.episodeNumber) AS latest_episode_number`. Navigation uses the nearest greater/lesser `episode_number`; series pages order episodes ascending.

## 5. How data gets in

1. **Admin manual entry:** `/vercel/share/v0-project/app/actions/admin.ts` exports `createSeriesAction`, `updateSeriesAction`, `createEpisodeAction`, and `updateEpisodeAction`; they call `createSeries`, `updateSeries`, `createEpisode`, and `updateEpisode` in `/vercel/share/v0-project/lib/db/queries.ts`. Admin pages are under `/vercel/share/v0-project/app/admin/series/` and `/vercel/share/v0-project/app/admin/episodes/`. These require the custom session checked by `requireSession()`.
2. **Play ingestion:** `POST /api/play/anime` in `/vercel/share/v0-project/app/api/play/anime/route.ts` authenticates with `hasValidPlayApiKey()`, de-duplicates by `series.anilist_id` or case-insensitive title when AniList ID is null, resolves/creates a creator, and inserts `series`. `POST /api/play/episodes` and `POST /api/play/fill` are the corresponding episode ingestion/fill paths. `/vercel/share/v0-project/app/api/play/videos/route.ts` handles movie/video records. The route emits `push_events` for new series.
3. **AniList backfill:** `/vercel/share/v0-project/lib/anilist-backfill.ts` finds up to 20 `series` rows with null `anilist_id`, calls `https://graphql.anilist.co`, auto-updates unambiguous rows, and inserts/updates `anime_match_candidates` for collisions. Admin routes: `/vercel/share/v0-project/app/api/admin/anilist-backfill/run/route.ts`, `/pending/route.ts`, `/[id]/merge/route.ts`, `/[id]/reject/route.ts`.
4. **AnimeSchedule sync:** `/vercel/share/v0-project/app/api/admin/animeschedule/sync/route.ts` supports authorized manual `POST` for one series and authorized `GET` batches of five for stale ongoing rows/backfill. It updates `animeschedule_slug`, `animeschedule_data`, and `animeschedule_synced_at`; it does not create episodes.
5. **No evidence found in this checkout of a pending-sync consumer from `play.otakunaija.name.ng`; the relevant current ingestion boundary is `/api/play/*`.** This conclusion is source-based, not a claim about external infrastructure outside this repository.

## 6. Existing API routes

All route files are under `/vercel/share/v0-project/app/api/`:

```text
/admin/anilist-backfill/[id]/merge  POST  merge candidate; admin session/route auth
/admin/anilist-backfill/[id]/reject POST reject candidate; admin route auth
/admin/anilist-backfill/pending     GET  pending candidates; admin route auth
/admin/anilist-backfill/run         POST run backfill; admin route auth
/admin/animeschedule/sync           GET/POST schedule sync; Bearer CRON_SECRET
/admin/news/[id]/delete             POST delete news item; API-key convention
/admin/news/[id]/mark-inserted      POST mark source item inserted; API-key convention
/admin/news/[id]                    GET/PATCH/DELETE news item; admin/news auth
/admin/news/list                    GET list news; admin/news auth
/admin/upload                       POST upload; admin auth
/auth/register                      POST comment-user registration
/cloudinary/sign                    POST signed upload parameters
/comments/[id]/like                 POST like/unlike comment
/comments/[id]/react                POST reaction
/comments/[id]/replies              GET replies
/cron/push-drain                    GET/POST push queue drain; cron secret
/cron/push-suggest                  GET/POST push suggestions; cron secret
/episodes/[id]/watch-ping           POST watch analytics ping
/episodes/recommendations           GET recommendations
/link-preview                       GET remote link preview
/play/anime                         POST anime/series ingestion; Play API key
/play/episodes                      POST episode ingestion; Play API key
/play/fill                          POST fill missing Play data; Play API key
/play/fix-titles                    POST title repair; Play API key
/play/videos                        POST video/movie ingestion; Play API key
/polls/result-view                  POST poll result view
/polls/vote                         POST vote
/posts/[slug]/activate              POST activate post
/posts/[slug]/annotations           GET/POST annotations
/posts/[slug]/comments              GET/POST comments
/r2/presign                         POST R2 presign; storage auth
/r2/subtitle                        GET/POST subtitle access/upload
```

The route that exposes currently airing anime is not a separate `/api/airing` endpoint. The current-airing data is exposed through page/server-query paths using `getSeriesByStatus('ongoing')` in `/vercel/share/v0-project/lib/db/queries.ts` and UI components such as `/vercel/share/v0-project/components/episodes/ongoing-series-scroll.tsx`; `POST /api/play/anime` also maps external `currently airing` to database status `ongoing`.

Caching: `unstable_cache` plus React `cache()` are used in `/vercel/share/v0-project/lib/db/queries.ts`, with TTLs from 60 seconds to 86,400 seconds and tags including `series`, `episodes`, and `sitemap`. `revalidatePath()` is used after admin writes and AnimeSchedule updates. Rate limiting uses the `rate_limits` table in poll-related code. Play endpoints use an API-key helper (`/vercel/share/v0-project/lib/play-auth.ts`); cron uses `Authorization: Bearer <CRON_SECRET>`. Comment APIs use `Authorization: Bearer <comment_users.token>` via `/vercel/share/v0-project/lib/auth-utils.ts`. No global CORS policy or middleware-based API auth was found in the route inventory.

## 7. Environment-variable names

- `DATABASE_URL` — primary Neon connection used by Drizzle and the lazy Neon client.
- `DATABASE_URL_UNPOOLED`, `POSTGRES_URL_NON_POOLING`, `POSTGRES_URL`, `POSTGRES_PRISMA_URL`, `PGHOST`, `PGHOST_UNPOOLED`, `PGDATABASE`, `PGUSER`, `PGPASSWORD`, `POSTGRES_HOST`, `POSTGRES_USER`, `POSTGRES_PASSWORD` — database connection aliases/parts available to the project; source inspection found application use of `DATABASE_URL`.
- `NEON_PROJECT_ID` — Neon project identifier.
- `ADMIN_PASSWORD`, `SESSION_SECRET` — custom admin credential/session configuration.
- `PLAY_API_KEY` — Play ingestion API authentication.
- `CRON_SECRET` — cron/scheduled route bearer authentication.
- `ANIMESCHEDULE_TOKEN` — AnimeSchedule API access.
- `NEWS_API_URL`, `NEWS_API_KEY` — external news API integration used by the existing admin news flow (`/admin/posts-latest`, `lib/news-proxy.ts`). Both flows are independent: the manual flow keeps working when these two are set, and the automation below never reads them.
- `CRON_SECRET` — bearer token for every `/api/cron/*` route, including `/api/cron/news`.

### Automated anime news (`/api/cron/news`, `lib/news/*`)

The automation reads Anime News Network's public RSS feed directly (no Consumet/Redis service), rewrites each story with Groq, and publishes it to the blog as a "News" post with `source_name` / `source_url` provenance. The schema it needs lives in `docs/sql/news-automation.sql` and is run by hand in the Neon SQL editor; the route never migrates.

- `GROQ_API_KEY` — **required** for rewriting. Sent as `Authorization: Bearer …` to `https://api.groq.com/openai/v1/chat/completions`. Without it the route returns 500 and publishes nothing (a `dry=1` run still works).
- `GROQ_MODEL` — optional, default `llama-3.3-70b-versatile`.
- `NEWS_AUTOPUBLISH` — default `true`. Only the literal string `true` auto-publishes; anything else parks finished rewrites in `news_ingest.rewritten` for approval in the admin Automation tab.
- `NEWS_MAX_PER_RUN` — default `3`, clamped to `1…10`. Items per cron run (the Groq free tier is rate limited).
- `NEWS_BLOCKED_KEYWORDS` — optional comma-separated list; a feed item whose title contains one is queued as `skipped` instead of rewritten.
- `NEWS_PUSH` — default off. When `true`, a published story sends at most one OneSignal push per run (`lib/push.ts`, requires the existing OneSignal vars).
- Reviews, features, interviews, columns and contests from the feed are queued as `skipped` (`filtered:not_news`): they are editorial pieces, not news, and would otherwise be published under the News category with a news byline. Retry any of them from the admin Automation tab if you want them anyway.
- `NEWS_FEED_URL` — optional override for the feed (default `https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w`).
### Daily newsletter (`/api/cron/newsletter`, `/api/webhooks/brevo`, `lib/newsletter/*`)

One issue per morning, prepared at 06:30 and sent at 07:00 Africa/Lagos. It signs people up with double opt-in, sends through Brevo's transactional API, records opens/clicks/bounces from Brevo webhooks, and needs the schema in `docs/sql/newsletter.sql`, which is run by hand in the Neon SQL editor; the routes never migrate.

- `BREVO_API_KEY` — **required to send**. Sent as the `api-key` header to `https://api.brevo.com/v3/smtp/email`. Without it the cron and admin pages say so plainly, the issue is still prepared and previewed, and nothing is sent.
- `BREVO_WEBHOOK_SECRET` — **required for the webhook**. Compared in constant time against either `Authorization: Bearer <secret>` or `?secret=<secret>` on `POST /api/webhooks/brevo`. Unset means the route refuses every request.
- `NEWSLETTER_FROM_EMAIL` — sender address (default `press@otakunaija.name.ng`). It must be a verified sender in the Brevo dashboard.
- `NEWSLETTER_FROM_NAME` — sender display name (default `OtakuNaija`).
- `NEWSLETTER_REPLY_TO` — optional reply-to address. When unset, replies go to the sender.
- `NEWSLETTER_MODE` — `approve` (default) or `auto`. `approve` leaves the prepared issue as a draft until an admin approves it; `auto` approves it during prepare so the 07:00 run sends it.
- `NEWSLETTER_DAILY_CAP` — default `250`. The hard ceiling on emails per UTC day, oldest `last_sent_at` first so everyone is served fairly.
- `NEWSLETTER_POSTAL_ADDRESS` — required footer line; the newsletter will not render without a postal address.
- `SITE_URL` — default `https://otakunaija.name.ng`; used for links in the email and for the unsubscribe URL.
- `GROQ_API_KEY` / `GROQ_MODEL` — shared with the news automation. Used for the subject, preheader and editor's note. Without a key the copy falls back to a rule-based version, so a missing key degrades the writing but never blocks the issue.

- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` — Cloudinary uploads/signing.
- `R2_ACCOUNT_ID`, `R2_BUCKET_NAME`, `R2_PUBLIC_URL`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` — object storage/R2.
- `NEXT_PUBLIC_ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY` — push notifications.
- `NEXT_PUBLIC_ADSENSE_CLIENT_ID`, `NEXT_PUBLIC_ADSENSE_CLIENT`, `NEXT_PUBLIC_MONETAG_ZONE_HEADER`, `NEXT_PUBLIC_MONETAG_ZONE_IN_ARTICLE`, `NEXT_PUBLIC_MONETAG_ZONE_SIDEBAR`, `NEXT_PUBLIC_MONETAG_ZONE_FOOTER` — advertising.
- `BLOG_RENDER_MODE` — blog rendering mode.
- `NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL` — legacy/external redirect setting; no Supabase integration is connected in this project.
- `VERCEL_AI_GATEWAY_*` is available through the connected Vercel AI Gateway integration, but no anime-search database path inspected here depends on it.

## 8. Risks and gotchas

1. **Schema drift:** live Postgres contains legacy tables not declared in `/lib/db/schema.ts`; do not assume the file is a complete database dump.
2. **Naming mismatch:** product language says anime, while the table is `series`; AniList is `anilist_id`; videos also have `anilist_id`; MAL exists only on `videos.mal_id`.
3. **Status mismatch:** live values are only `ongoing` and `completed`; code accepts `upcoming` in one query but ingestion maps “not yet aired” to `ongoing`.
4. **No episode uniqueness:** `(series_id, episode_number)` has no unique constraint; duplicate numbers can make `MAX()` appear valid while navigation and search return duplicates.
5. **Known gaps:** episode numbers are not contiguous for many series; gaps are real data, not just a UI issue.
6. **Six empty series:** current series rows exist without episodes.
7. **Nullable unique AniList IDs:** null values are allowed and multiple nulls are legal; backfill and ingestion must handle races and title collisions.
8. **Mixed timestamps:** many legacy tables use `timestamp without time zone`, while episode publication and AnimeSchedule sync use `timestamp with time zone`.
9. **Two database access abstractions:** both `drizzle-orm/neon-serverless` and the lazy `neon()` client are active. A new API should follow one convention and preserve parameterization.
10. **Caching can hide writes:** series/episode reads are cached for up to one hour; new search endpoints need deliberate cache tags/TTL and invalidation after ingestion.
11. **Search indexes are limited:** search in `/lib/db/queries.ts` uses `ILIKE '%...%'` over title/synopsis and has no declared trigram/full-text index; this will become a scalability risk as `series`/`episodes` grow.
12. **Authentication is route-specific:** admin session cookies, Play API key, cron bearer secret, and comment-user bearer tokens are separate conventions. Do not treat any route as authenticated merely because it is under `/api`.
13. **Sensitive comment token:** `comment_users.token` is a bearer credential and must never be returned by a new public search response.
14. **Report limitation:** the live view query was not completed because one read-only call used a non-existent branch identifier. Before a schema change, rerun `pg_views`/`pg_matviews` and `pg_trigger` catalog queries against branch `br-billowing-glitter-aneithqz` and compute `ep-summer-wildflower-anz25t9d`.

## Recommended pre-implementation checks

Before adding anime search or a nullable airing field: reconcile live-only tables into a deliberate migration policy; rerun full `pg_indexes`, FK, views, triggers, and row-count queries; decide whether the canonical entity is `series.id` or AniList ID; add a uniqueness policy for `(series_id, episode_number)` only after auditing duplicates; and choose PostgreSQL full-text/trigram indexing rather than unbounded `ILIKE` if the endpoint will serve production traffic.

**No code or database changes were made by this audit.**
