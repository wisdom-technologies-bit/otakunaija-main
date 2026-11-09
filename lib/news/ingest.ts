import { fetchArticle, fetchFeed, type ArticleContent, type FeedItem } from "./ann"
import { DEFAULT_MAX_AGE_HOURS, parseBlockedKeywords, selectFeedItems } from "./filters"
import { copyImageToCloudinary, type CopyImageLike } from "./image"
import { publishIngestRow } from "./publish"
import { rewriteArticle, type RewriteOutcome } from "./rewrite"
import { sqlStore, type IngestRow, type NewsStore } from "./store"

/**
 * The cron pipeline, separated from the HTTP route so it can be unit tested
 * against an in-memory store.
 *
 * Order of operations per run:
 *   1. fetch the ANN feed
 *   2. queue unseen items (72h window, on-topic, not blocklisted)
 *   3. process up to `limit` rows: fetch article → rewrite → validate → publish
 */

export const DEFAULT_MAX_PER_RUN = 3
export const HARD_MAX_PER_RUN = 10
/** Leave headroom inside the route's maxDuration. */
export const DEFAULT_DEADLINE_MS = 45_000

export type NewsRunConfig = {
  limit: number
  dry: boolean
  forceGuid: string | null
  autopublish: boolean
  pushEnabled: boolean
  blockedKeywords: string[]
  maxAgeHours: number
  deadlineMs: number
}

function isTrue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined || value.trim() === "") return fallback
  return value.trim().toLowerCase() === "true"
}

function readInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(String(value ?? ""), 10)
  return Number.isFinite(parsed) ? parsed : fallback
}

export function readConfig(overrides: Partial<NewsRunConfig> = {}): NewsRunConfig {
  const limit = overrides.limit ?? readInt(process.env.NEWS_MAX_PER_RUN, DEFAULT_MAX_PER_RUN)
  return {
    limit: Number.isFinite(limit) ? Math.min(HARD_MAX_PER_RUN, Math.max(1, Math.trunc(limit))) : DEFAULT_MAX_PER_RUN,
    dry: overrides.dry ?? false,
    forceGuid: overrides.forceGuid?.trim() || null,
    // Only the literal string "true" keeps auto-publishing on; anything else
    // (including a typo) parks rows in `rewritten` for admin approval.
    autopublish: overrides.autopublish ?? isTrue(process.env.NEWS_AUTOPUBLISH, true),
    pushEnabled: overrides.pushEnabled ?? isTrue(process.env.NEWS_PUSH, false),
    blockedKeywords: overrides.blockedKeywords ?? parseBlockedKeywords(process.env.NEWS_BLOCKED_KEYWORDS),
    maxAgeHours: overrides.maxAgeHours ?? DEFAULT_MAX_AGE_HOURS,
    deadlineMs: overrides.deadlineMs ?? DEFAULT_DEADLINE_MS,
  }
}

export type NewsRunCounts = {
  fetched: number
  /** Cover problems counted by reason (image_http_403, cloudinary_not_configured…). */
  imageReasons: Record<string, number>
  new: number
  published: number
  rewritten: number
  failed: number
  skipped: number
  remaining: number
  dry: boolean
}

export type NewsRunPlanItem = {
  guid: string
  title: string
  action: "fetch_and_rewrite" | "publish_rewritten" | "insert_pending" | "insert_skipped"
  status: string
  reason?: string
}

export type NewsRunResult = NewsRunCounts & {
  error?: string
  plan?: NewsRunPlanItem[]
  log: string[]
}

export type NewsRunDeps = {
  store: NewsStore
  fetchFeed: (feedUrl?: string) => Promise<{ ok: true; data: { items: FeedItem[] } } | { ok: false; error: string }>
  fetchArticle: (url: string) => Promise<{ ok: true; data: ArticleContent } | { ok: false; error: string }>
  rewrite: (input: { title: string; text: string; url: string; topics: string[] }) => Promise<RewriteOutcome>
  copyImage: (imageUrl: string | null) => Promise<CopyImageLike>
  push: (payload: { title: string; path: string; image: string | null; message: string }) => Promise<void>
  now: () => Date
}

const defaultPush: NewsRunDeps["push"] = async ({ title, path, message }) => {
  // Imported lazily so this module stays test-friendly (lib/push is server-only).
  const { sendPush } = await import("@/lib/push")
  await sendPush({ title, message, path })
}

export const defaultDeps: NewsRunDeps = {
  store: sqlStore,
  fetchFeed,
  fetchArticle,
  rewrite: rewriteArticle,
  copyImage: copyImageToCloudinary,
  push: defaultPush,
  now: () => new Date(),
}

function emptyCounts(dry: boolean): NewsRunCounts {
  return { fetched: 0, new: 0, published: 0, rewritten: 0, failed: 0, skipped: 0, remaining: 0, dry, imageReasons: {} }
}

/**
 * Runs one ingestion pass. Never throws: every failure is reported in the
 * returned object (and, for row-level failures, in `last_error`).
 */
export async function runNewsIngest(
  options: Partial<Pick<NewsRunConfig, "limit" | "dry" | "forceGuid">> = {},
  deps: Partial<NewsRunDeps> = {},
): Promise<NewsRunResult> {
  const config = readConfig(options)
  const resolved = { ...defaultDeps, ...deps }
  const counts = emptyCounts(config.dry)
  const log: string[] = []
  const plan: NewsRunPlanItem[] = []
  const startedAt = Date.now()
  let pushSent = false

  const record = (line: string) => {
    // Short, secret-free lines only: never article text or env values.
    log.push(line)
    if (log.length > 40) log.shift()
  }

  let feed: Awaited<ReturnType<NewsRunDeps["fetchFeed"]>>
  try {
    feed = await resolved.fetchFeed()
  } catch (error) {
    return { ...counts, error: `feed_threw: ${error instanceof Error ? error.message : String(error)}`, log }
  }

  if (!feed.ok) {
    record(`feed failed: ${feed.error}`)
    return { ...counts, error: feed.error, log }
  }

  const items = feed.data.items
  counts.fetched = items.length
  record(`feed ok: ${items.length} items`)

  const selection = selectFeedItems(items, {
    now: resolved.now(),
    maxAgeHours: config.maxAgeHours,
    blockedKeywords: config.blockedKeywords,
  })
  counts.skipped += selection.tooOld.length + selection.filtered.length

  const pendingRows = selection.accepted.map((item) => ({
    guid: item.guid,
    sourceUrl: item.link,
    sourceName: "Anime News Network",
    title: item.title,
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    topics: item.topics,
    status: "pending" as const,
  }))

  const skippedRows = selection.filtered.map(({ item, reason }) => ({
    guid: item.guid,
    sourceUrl: item.link,
    sourceName: "Anime News Network",
    title: item.title,
    publishedAt: item.publishedAt,
    imageUrl: item.imageUrl,
    topics: item.topics,
    status: "skipped" as const,
    lastError: `filtered:${reason}`,
  }))

  if (config.dry) {
    for (const row of pendingRows) {
      plan.push({ guid: row.guid, title: row.title, action: "insert_pending", status: "pending" })
    }
    for (const row of skippedRows) {
      plan.push({
        guid: row.guid,
        title: row.title,
        action: "insert_skipped",
        status: "skipped",
        reason: row.lastError ?? undefined,
      })
    }
  } else {
    try {
      counts.new = await resolved.store.insertItems(pendingRows)
      await resolved.store.insertItems(skippedRows)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      record(`queue insert failed: ${message}`)
      return { ...counts, error: `queue_insert_failed: ${message}`, log }
    }
  }

  let candidates: IngestRow[] = []
  try {
    candidates = await resolved.store.listCandidates({
      limit: config.forceGuid ? 1 : config.limit,
      includeRewritten: config.autopublish || Boolean(config.forceGuid),
      forceGuid: config.forceGuid,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    record(`candidate query failed: ${message}`)
    return { ...counts, error: `candidate_query_failed: ${message}`, log }
  }

  if (config.forceGuid && candidates.length === 0) {
    record(`force_guid not found: ${config.forceGuid}`)
    return { ...counts, error: "force_guid_not_found", log }
  }

  for (const row of candidates) {
    if (Date.now() - startedAt > config.deadlineMs) {
      record("deadline reached, stopping this run")
      break
    }

    const title = row.original_title ?? row.guid
    let article = row.rewritten
    let articleImageUrl: string | null = null

    if (!article) {
      if (config.dry) {
        plan.push({ guid: row.guid, title, action: "fetch_and_rewrite", status: row.status })
        counts.rewritten += 1
        if (config.autopublish) counts.published += 1
        continue
      }

      const articleResult = await resolved.fetchArticle(row.source_url)
      if (!articleResult.ok) {
        const attempts = row.attempts + 1
        await resolved.store.setStatus(row.id, "failed", {
          error: `article_fetch_failed: ${articleResult.error}`,
          attempts,
        })
        counts.failed += 1
        record(`article failed guid=${row.guid}: ${articleResult.error}`)
        continue
      }

      // Keep the og:image on the row: a publish in a later run must not lose it.
      articleImageUrl = articleResult.data.imageUrl ?? null
      if (articleImageUrl && articleImageUrl !== row.image_url) {
        await resolved.store.setImageUrl?.(row.id, articleImageUrl)
      }

      const outcome = await resolved.rewrite({
        title: row.original_title ?? articleResult.data.title ?? "",
        text: articleResult.data.text,
        url: row.source_url,
        topics: row.topics ?? [],
      })

      if (!outcome.ok) {
        if (outcome.deferred) {
          // Rate limited: keep it pending so a later run retries for free.
          await resolved.store.setStatus(row.id, "pending", { error: `deferred: ${outcome.reason}` })
          record(`rewrite deferred guid=${row.guid}: ${outcome.reason}`)
          continue
        }
        const attempts = row.attempts + 1
        await resolved.store.setStatus(row.id, "failed", { error: `rewrite_rejected: ${outcome.reason}`, attempts })
        counts.failed += 1
        record(`rewrite rejected guid=${row.guid}: ${outcome.reason}`)
        continue
      }

      await resolved.store.markRewritten(row.id, outcome.data, row.attempts + 1)
      counts.rewritten += 1
      article = outcome.data
      record(`rewritten guid=${row.guid} words=${outcome.data.content.split(/\s+/).length}`)

      if (!config.autopublish) {
        record(`autopublish off, parked guid=${row.guid} for admin approval`)
        continue
      }
    } else if (config.dry) {
      plan.push({ guid: row.guid, title, action: "publish_rewritten", status: row.status })
      counts.published += 1
      continue
    }

    const published = await publishIngestRow(
      { ...row, rewritten: article },
      {
        store: resolved.store,
        copyImage: resolved.copyImage,
        articleImageUrl,
        log: record,
      },
    )

    if (!published.ok) {
      counts.failed += 1
      continue
    }

    counts.published += 1
    if (published.imageReason) {
      counts.imageReasons[published.imageReason] = (counts.imageReasons[published.imageReason] ?? 0) + 1
    }

    if (config.pushEnabled && !pushSent) {
      try {
        await resolved.push({
          title: "New on OtakuNaija",
          message: `New on the blog: ${published.title}`,
          path: `/blog/${published.slug}`,
          image: null,
        })
        pushSent = true
      } catch (error) {
        record(`push failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  try {
    counts.remaining = await resolved.store.countRemaining({
      includeRewritten: config.autopublish || Boolean(config.forceGuid),
    })
  } catch {
    counts.remaining = 0
  }

  return {
    ...counts,
    log,
    ...(config.dry ? { plan } : {}),
  }
}
