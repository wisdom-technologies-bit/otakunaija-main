/**
 * Database access for the newsletter.
 *
 * Raw SQL through the same Neon tagged-template client the rest of the app
 * uses (the newsletter tables have no Drizzle schema, exactly like
 * `news_ingest` and `upcoming_anime`). Every function here is thin: the
 * decisions live in select/copy/send, which are unit tested without a database.
 */

import { sql } from "@/lib/db"
import { getUpcomingForNewsletter, getUpcomingBySeason } from "@/lib/anilist/upcoming-store"
import { getTrendingSeries } from "@/lib/db/queries"
import type { LayoutId, LayoutVariant } from "./layout"
import {
  DEFAULT_PREFS,
  normalisePrefs,
  type IssueContent,
  type NewsletterCopy,
  type NewsletterPrefs,
  type SelectSources,
  type SubscriberRow,
} from "./types"

export type IssueStatus = "draft" | "approved" | "sending" | "sent" | "skipped" | "failed"

export type IssueRow = {
  id: number
  issueDate: string
  status: IssueStatus
  layout: LayoutId | null
  subject: string | null
  preheader: string | null
  editorsNote: string | null
  payload: IssuePayload | null
  htmlSize: number | null
  recipients: number
  sent: number
  failed: number
  createdAt: string | null
  approvedAt: string | null
  sentAt: string | null
  error: string | null
}

export type IssuePayload = {
  content: IssueContent
  copy: NewsletterCopy
  variant: LayoutVariant
  /** Layout reason and copy provenance, for the admin screen and debugging. */
  meta?: {
    layoutReason?: string
    copyReasons?: string[]
    copySource?: string
    format?: string
  }
  /** Post ids used, so the next three issues can avoid repeating them. */
  postIds?: number[]
}

export type RecipientRow = {
  id: number
  email: string
  token: string
  prefs: NewsletterPrefs
  lastSentAt: string | null
}

export type StatusCounts = Record<string, number>

type Row = Record<string, unknown>

function str(value: unknown): string | null {
  if (value instanceof Date) return value.toISOString()
  if (typeof value === "string" && value.length) return value
  return null
}

function num(value: unknown): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function dateOnly(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10)
  const text = String(value ?? "")
  return text.slice(0, 10)
}

function toIssue(row: Row): IssueRow {
  return {
    id: num(row.id),
    issueDate: dateOnly(row.issue_date),
    status: (row.status as IssueStatus) ?? "draft",
    layout: (row.layout as LayoutId) ?? null,
    subject: str(row.subject),
    preheader: str(row.preheader),
    editorsNote: str(row.editors_note),
    payload: (row.payload as IssuePayload) ?? null,
    htmlSize: row.html_size === null || row.html_size === undefined ? null : num(row.html_size),
    recipients: num(row.recipients),
    sent: num(row.sent),
    failed: num(row.failed),
    createdAt: str(row.created_at),
    approvedAt: str(row.approved_at),
    sentAt: str(row.sent_at),
    error: str(row.error),
  }
}

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export async function getSetting(key: string): Promise<string | null> {
  try {
    const rows = (await sql`SELECT value FROM newsletter_settings WHERE key = ${key} LIMIT 1`) as Row[]
    return str(rows[0]?.value)
  } catch {
    return null
  }
}

export async function setSetting(key: string, value: string): Promise<void> {
  await sql`
    INSERT INTO newsletter_settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
  `
}

export async function isPaused(): Promise<boolean> {
  return (await getSetting("paused")) === "true"
}

// ---------------------------------------------------------------------------
// Issues
// ---------------------------------------------------------------------------

export async function getIssueByDate(issueDate: string): Promise<IssueRow | null> {
  const rows = (await sql`
    SELECT * FROM newsletter_issues WHERE issue_date = ${issueDate}::date LIMIT 1
  `) as Row[]
  return rows[0] ? toIssue(rows[0]) : null
}

export async function getIssue(id: number): Promise<IssueRow | null> {
  const rows = (await sql`SELECT * FROM newsletter_issues WHERE id = ${id} LIMIT 1`) as Row[]
  return rows[0] ? toIssue(rows[0]) : null
}

export async function listIssues(limit = 40): Promise<IssueRow[]> {
  const rows = (await sql`
    SELECT * FROM newsletter_issues ORDER BY issue_date DESC LIMIT ${limit}
  `) as Row[]
  return rows.map(toIssue)
}

export type InsertIssueInput = {
  issueDate: string
  status: IssueStatus
  layout: LayoutId | null
  subject: string | null
  preheader: string | null
  editorsNote: string | null
  payload: IssuePayload | null
  htmlSize?: number | null
  error?: string | null
}

export async function insertIssue(input: InsertIssueInput): Promise<IssueRow> {
  const rows = (await sql`
    INSERT INTO newsletter_issues (
      issue_date, status, layout, subject, preheader, editors_note, payload, html_size,
      approved_at, error
    ) VALUES (
      ${input.issueDate}::date,
      ${input.status},
      ${input.layout},
      ${input.subject},
      ${input.preheader},
      ${input.editorsNote},
      ${input.payload ? JSON.stringify(input.payload) : null}::jsonb,
      ${input.htmlSize ?? null},
      ${input.status === "approved" ? new Date().toISOString() : null}::timestamptz,
      ${input.error ?? null}
    )
    ON CONFLICT (issue_date) DO NOTHING
    RETURNING *
  `) as Row[]

  if (rows[0]) return toIssue(rows[0])
  const existing = await getIssueByDate(input.issueDate)
  if (!existing) throw new Error("issue insert failed")
  return existing
}

export type UpdateIssueInput = {
  status?: IssueStatus
  subject?: string | null
  preheader?: string | null
  editorsNote?: string | null
  payload?: IssuePayload | null
  htmlSize?: number | null
  recipients?: number
  sent?: number
  failed?: number
  error?: string | null
  approvedAt?: string | null
  sentAt?: string | null
}

export async function updateIssue(id: number, patch: UpdateIssueInput): Promise<IssueRow | null> {
  const rows = (await sql`
    UPDATE newsletter_issues SET
      status = COALESCE(${patch.status ?? null}, status),
      subject = COALESCE(${patch.subject ?? null}, subject),
      preheader = COALESCE(${patch.preheader ?? null}, preheader),
      editors_note = COALESCE(${patch.editorsNote ?? null}, editors_note),
      payload = COALESCE(${patch.payload ? JSON.stringify(patch.payload) : null}::jsonb, payload),
      html_size = COALESCE(${patch.htmlSize ?? null}, html_size),
      recipients = COALESCE(${patch.recipients ?? null}, recipients),
      sent = COALESCE(${patch.sent ?? null}, sent),
      failed = COALESCE(${patch.failed ?? null}, failed),
      error = ${patch.error ?? null},
      approved_at = CASE
        WHEN ${patch.approvedAt ?? null}::timestamptz IS NOT NULL THEN ${patch.approvedAt ?? null}::timestamptz
        ELSE approved_at END,
      sent_at = CASE
        WHEN ${patch.sentAt ?? null}::timestamptz IS NOT NULL THEN ${patch.sentAt ?? null}::timestamptz
        ELSE sent_at END
    WHERE id = ${id}
    RETURNING *
  `) as Row[]
  return rows[0] ? toIssue(rows[0]) : null
}

/** The last issue that actually went out; the selection window starts there. */
export async function lastSentIssue(now: Date): Promise<IssueRow | null> {
  const rows = (await sql`
    SELECT * FROM newsletter_issues
    WHERE status = 'sent' AND sent_at IS NOT NULL AND sent_at <= ${now.toISOString()}::timestamptz
    ORDER BY sent_at DESC
    LIMIT 1
  `) as Row[]
  return rows[0] ? toIssue(rows[0]) : null
}

/** Recent issues, newest first, for the no-repeat rule and subject history. */
export async function recentIssues(limit: number): Promise<IssueRow[]> {
  const rows = (await sql`
    SELECT * FROM newsletter_issues
    WHERE status IN ('sent', 'approved', 'sending')
    ORDER BY issue_date DESC
    LIMIT ${limit}
  `) as Row[]
  return rows.map(toIssue)
}

export async function countIssuesByStatus(): Promise<Record<IssueStatus, number>> {
  const rows = (await sql`
    SELECT status, COUNT(*)::int AS count FROM newsletter_issues GROUP BY status
  `) as Row[]
  const out: Record<IssueStatus, number> = { draft: 0, approved: 0, sending: 0, sent: 0, skipped: 0, failed: 0 }
  for (const row of rows) {
    const key = String(row.status) as IssueStatus
    if (key in out) out[key] = num(row.count)
  }
  return out
}

// ---------------------------------------------------------------------------
// Subscribers
// ---------------------------------------------------------------------------

export async function countSubscribersByStatus(): Promise<StatusCounts> {
  const rows = (await sql`
    SELECT status, COUNT(*)::int AS count FROM subscribers GROUP BY status
  `) as Row[]
  const out: StatusCounts = {}
  for (const row of rows) out[String(row.status)] = num(row.count)
  return out
}

/** Emails already sent inside the current UTC day, for the daily cap. */
export async function countSentToday(utcDayStart: Date): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS count FROM subscribers
    WHERE last_sent_at IS NOT NULL AND last_sent_at >= ${utcDayStart.toISOString()}::timestamptz
  `) as Row[]
  return num(rows[0]?.count)
}

export type ListRecipientsInput = {
  issueId: number
  issueStart: Date
  limit: number
  /** Weekly subscribers only receive the Sunday issue. */
  includeWeekly: boolean
}

/**
 * Active subscribers who have not received this issue yet, oldest served first
 * so the daily cap rotates fairly. The two exclusions are the resume guard:
 * a per-issue marker (`last_issue_id`) and the belt-and-braces timestamp check.
 */
export async function listRecipients(input: ListRecipientsInput): Promise<RecipientRow[]> {
  const rows = (await sql`
    SELECT id, email, token, prefs, last_sent_at
    FROM subscribers
    WHERE status = 'active'
      AND token IS NOT NULL
      AND (last_issue_id IS NULL OR last_issue_id <> ${input.issueId})
      AND (last_sent_at IS NULL OR last_sent_at < ${input.issueStart.toISOString()}::timestamptz)
      AND (${input.includeWeekly}::boolean OR COALESCE(prefs->>'frequency', 'daily') <> 'weekly')
    ORDER BY last_sent_at ASC NULLS FIRST, id ASC
    LIMIT ${input.limit}
  `) as Row[]

  return rows.map((row) => ({
    id: num(row.id),
    email: String(row.email ?? ""),
    token: String(row.token ?? ""),
    prefs: row.prefs ? normalisePrefs(row.prefs) : DEFAULT_PREFS,
    lastSentAt: str(row.last_sent_at),
  }))
}

/** Records a chunk as delivered for these subscribers. */
/** Active subscribers on the weekly cadence. */
export async function countWeekly(): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS count FROM subscribers
    WHERE status = 'active' AND COALESCE(prefs->>'frequency', 'daily') = 'weekly'
  `) as Row[]
  return num(rows[0]?.count)
}

export async function markSent(subscriberIds: number[], issueId: number, at: Date): Promise<void> {
  if (!subscriberIds.length) return
  const payload = JSON.stringify(subscriberIds.map((id) => ({ id })))
  await sql`
    UPDATE subscribers s
    SET last_sent_at = ${at.toISOString()}::timestamptz, last_issue_id = ${issueId}
    FROM jsonb_to_recordset(${payload}::jsonb) AS x(id int)
    WHERE s.id = x.id
  `
}

function toSubscriber(row: Row): SubscriberRow {
  return {
    id: num(row.id),
    email: String(row.email ?? ""),
    token: String(row.token ?? ""),
    status: String(row.status ?? "active"),
    prefs: normalisePrefs(row.prefs),
    confirmedAt: str(row.confirmed_at),
    unsubscribedAt: str(row.unsubscribed_at),
    source: str(row.source),
    createdAt: str(row.created_at),
    lastIssueId: row.last_issue_id === null || row.last_issue_id === undefined ? null : num(row.last_issue_id),
  }
}

export async function getSubscriberByEmail(email: string): Promise<SubscriberRow | null> {
  const rows = (await sql`
    SELECT * FROM subscribers WHERE lower(email) = lower(${email}) LIMIT 1
  `) as Row[]
  return rows[0] ? toSubscriber(rows[0]) : null
}

export async function getSubscriberByToken(token: string): Promise<SubscriberRow | null> {
  const rows = (await sql`SELECT * FROM subscribers WHERE token = ${token} LIMIT 1`) as Row[]
  return rows[0] ? toSubscriber(rows[0]) : null
}

export async function insertSubscriber(email: string, source: string): Promise<SubscriberRow> {
  const rows = (await sql`
    INSERT INTO subscribers (email, status, source, prefs)
    VALUES (${email}, 'pending', ${source}, ${JSON.stringify(DEFAULT_PREFS)}::jsonb)
    ON CONFLICT DO NOTHING
    RETURNING *
  `) as Row[]
  if (rows[0]) return toSubscriber(rows[0])
  const existing = await getSubscriberByEmail(email)
  if (!existing) throw new Error("subscriber insert failed")
  return existing
}

/**
 * Re-opens a subscription that previously ended: keeps the same row (and token)
 * but returns it to `pending` so the address has to confirm again.
 */
export async function setSubscriberPending(id: number, request: { source: string; token?: string }): Promise<void> {
  await sql`
    UPDATE subscribers SET
      status = 'pending',
      source = ${request.source},
      confirmed_at = NULL,
      unsubscribed_at = NULL,
      unsubscribe_reason = NULL,
      token = COALESCE(${request.token ?? null}, token)
    WHERE id = ${id}
  `
}

export async function confirmSubscriber(id: number, at: Date): Promise<void> {
  await sql`
    UPDATE subscribers SET status = 'active', confirmed_at = ${at.toISOString()}::timestamptz
    WHERE id = ${id} AND status <> 'active'
  `
}

export async function unsubscribeSubscriber(id: number, at: Date, reason: string | null): Promise<void> {
  await sql`
    UPDATE subscribers SET
      status = CASE WHEN status = 'bounced' OR status = 'complained' THEN status ELSE 'unsubscribed' END,
      unsubscribed_at = ${at.toISOString()}::timestamptz,
      unsubscribe_reason = ${reason}
    WHERE id = ${id}
  `
}

export async function updateSubscriberPrefs(id: number, prefs: NewsletterPrefs): Promise<void> {
  await sql`
    UPDATE subscribers SET prefs = ${JSON.stringify(prefs)}::jsonb WHERE id = ${id}
  `
}

export async function setSubscriberStatus(id: number, status: string): Promise<void> {
  await sql`UPDATE subscribers SET status = ${status} WHERE id = ${id}`
}

// ---------------------------------------------------------------------------
// Events
// ---------------------------------------------------------------------------

export type EventInput = {
  issueId: number | null
  subscriberId: number | null
  event: string
  url: string | null
  occurredAt: string | null
  brevoMessageId: string | null
}

/** Inserts an event, returning false when the unique key says it is a retry. */
export async function insertEvent(input: EventInput): Promise<boolean> {
  const rows = (await sql`
    INSERT INTO newsletter_events (issue_id, subscriber_id, event, url, occurred_at, brevo_message_id)
    VALUES (
      ${input.issueId},
      ${input.subscriberId},
      ${input.event},
      ${input.url},
      ${input.occurredAt}::timestamptz,
      ${input.brevoMessageId}
    )
    ON CONFLICT (brevo_message_id, event, coalesce(url, '')) DO NOTHING
    RETURNING id
  `) as Row[]
  return rows.length > 0
}

/** How many times this subscriber produced a given event. */
export async function countEvents(subscriberId: number, event: string): Promise<number> {
  const rows = (await sql`
    SELECT COUNT(*)::int AS count FROM newsletter_events
    WHERE subscriber_id = ${subscriberId} AND event = ${event}
  `) as Row[]
  return num(rows[0]?.count)
}

export type IssueStats = {
  recipients: number
  delivered: number
  opened: number
  clicked: number
  bounced: number
  complained: number
  unsubscribed: number
}

/** Unique-ish engagement numbers for one issue. */
export async function issueStats(issueId: number): Promise<IssueStats> {
  const rows = (await sql`
    SELECT
      COALESCE(MAX(i.recipients), 0)::int AS recipients,
      COUNT(*) FILTER (WHERE e.event = 'delivered')::int AS delivered,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'opened')::int AS opened,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'clicked')::int AS clicked,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'bounced')::int AS bounced,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'complained')::int AS complained,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'unsubscribed')::int AS unsubscribed
    FROM newsletter_issues i
    LEFT JOIN newsletter_events e ON e.issue_id = i.id
    WHERE i.id = ${issueId}
    GROUP BY i.id
  `) as Row[]
  const row = rows[0] ?? {}
  return {
    recipients: num(row.recipients),
    delivered: num(row.delivered),
    opened: num(row.opened),
    clicked: num(row.clicked),
    bounced: num(row.bounced),
    complained: num(row.complained),
    unsubscribed: num(row.unsubscribed),
  }
}

export async function statsForIssues(issueIds: number[]): Promise<Map<number, IssueStats>> {
  const out = new Map<number, IssueStats>()
  if (!issueIds.length) return out
  const payload = JSON.stringify(issueIds.map((id) => ({ id })))
  const rows = (await sql`
    SELECT
      e.issue_id,
      COUNT(*) FILTER (WHERE e.event = 'delivered')::int AS delivered,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'opened')::int AS opened,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'clicked')::int AS clicked,
      COUNT(DISTINCT e.subscriber_id) FILTER (WHERE e.event = 'bounced')::int AS bounced
    FROM newsletter_events e
    JOIN jsonb_to_recordset(${payload}::jsonb) AS x(id int) ON e.issue_id = x.id
    GROUP BY e.issue_id
  `) as Row[]

  for (const row of rows) {
    out.set(num(row.issue_id), {
      recipients: 0,
      delivered: num(row.delivered),
      opened: num(row.opened),
      clicked: num(row.clicked),
      bounced: num(row.bounced),
      complained: 0,
      unsubscribed: 0,
    })
  }
  return out
}

// ---------------------------------------------------------------------------
// Content sources
// ---------------------------------------------------------------------------

function isoOrNull(value: unknown): string | null {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString()
  const date = new Date(String(value))
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

type PostRow = Row & { id: number; slug: string; title: string }

async function readPosts(since: Date): Promise<SelectSources["posts"]> {
  try {
    const rows = (await sql`
      SELECT id, slug, title, excerpt, category, cover_image, views, featured, published_at, source_name
      FROM posts
      WHERE published_at <= now()
        AND published_at >= ${since.toISOString()}::timestamptz
      ORDER BY published_at DESC
      LIMIT 40
    `) as PostRow[]

    return rows.map((row) => ({
      id: Number(row.id),
      slug: String(row.slug),
      title: String(row.title),
      excerpt: (row.excerpt as string) ?? null,
      category: (row.category as string) ?? "News",
      coverImage: (row.cover_image as string) ?? null,
      views: Number(row.views ?? 0),
      featured: Boolean(row.featured),
      publishedAt: isoOrNull(row.published_at),
      sourceName: (row.source_name as string) ?? null,
    }))
  } catch {
    return []
  }
}

async function readEpisodes(since: Date): Promise<SelectSources["episodes"]> {
  try {
    const rows = (await sql`
      SELECT
        e.id, e.episode_number, e.title, e.slug, e.published_at, e.duration_seconds,
        s.id AS series_id, s.slug AS series_slug, s.title AS series_title,
        s.poster_image_url AS series_poster, s.thumbnail_url AS series_thumbnail
      FROM episodes e
      JOIN series s ON s.id = e.series_id
      WHERE e.published_at <= now()
        AND e.published_at >= ${since.toISOString()}::timestamptz
      ORDER BY e.published_at DESC
      LIMIT 60
    `) as Row[]

    return rows.map((row) => ({
      id: Number(row.id),
      episodeNumber: row.episode_number === null ? null : Number(row.episode_number),
      title: (row.title as string) ?? null,
      slug: (row.slug as string) ?? null,
      seriesId: row.series_id === null ? null : Number(row.series_id),
      seriesSlug: (row.series_slug as string) ?? null,
      seriesTitle: (row.series_title as string) ?? null,
      seriesPoster: (row.series_poster as string) ?? null,
      thumbnail: (row.series_thumbnail as string) ?? null,
      publishedAt: isoOrNull(row.published_at),
      durationSeconds: row.duration_seconds === null ? null : Number(row.duration_seconds),
      adult: false,
    }))
  } catch {
    return []
  }
}

/** Absolute href for a N2 reader item, which may carry a site-relative link. */
function absoluteHref(href: string | null | undefined, siteUrl: string): string | null {
  if (!href) return null
  if (href.startsWith("http://") || href.startsWith("https://")) return href
  return `${siteUrl.replace(/\/+$/, "")}${href.startsWith("/") ? href : `/${href}`}`
}

export type SourceOptions = {
  siteUrl: string
  now: Date
  /** Hours of airing schedule to read (36 for the modules, 192 for the table). */
  airingHours: number
}

export async function readSelectSources(options: SourceOptions): Promise<SelectSources> {
  const since = new Date(options.now.getTime() - 48 * 3_600_000)

  const [posts, episodes, airingFeed, seasonFeed, trendingRows] = await Promise.all([
    readPosts(since),
    readEpisodes(since),
    getUpcomingForNewsletter(Math.max(36, options.airingHours), options.now).catch(() => []),
    getUpcomingBySeason(options.now).catch(() => ({ items: [], lastUpdated: null })),
    getTrendingSeries(3).catch(() => []),
  ])

  const airing: SelectSources["airing"] = airingFeed.map((item) => ({
    anilistId: item.anilistId,
    title: item.title,
    episode: item.episode,
    airingAt: item.airingAt,
    coverUrl: item.coverUrl,
    siteUrl: absoluteHref(item.href, options.siteUrl),
    popularity: item.popularity ?? 0,
    adult: item.isAdult === true,
  }))

  const upcoming: SelectSources["upcoming"] = seasonFeed.items.map((item) => ({
    anilistId: item.anilistId,
    title: item.title,
    startDate: item.startDateIso,
    coverUrl: item.coverUrl,
    siteUrl: absoluteHref(item.href, options.siteUrl),
    format: item.format,
    seasonYear: item.seasonYear,
    season: item.season,
    popularity: item.popularity ?? 0,
    adult: item.isAdult === true,
  }))

  const trending: SelectSources["trending"] = (trendingRows as unknown as {
    series: { slug: string; title: string; posterImageUrl: string | null }
    totalViews: number
  }[]).map((row) => ({
    slug: row.series.slug,
    title: row.series.title,
    poster: row.series.posterImageUrl,
    totalViews: Number(row.totalViews ?? 0),
  }))

  return { posts, episodes, airing, upcoming, trending }
}
