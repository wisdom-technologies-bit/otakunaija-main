import "server-only"

import { and, asc, eq, gt, inArray, lt, sql as drizzleSql } from "drizzle-orm"
import { db } from "@/lib/db/index"
import { episodes, pushEvents, series } from "@/lib/db/schema"
import { sql } from "@/lib/db"

const BASE_URL = "https://otakunaija.name.ng"
const MAX_NOTIFICATIONS = 8
const MAX_AGE_MS = 48 * 60 * 60 * 1000

type PushType = "post" | "series" | "episode" | "suggestion"
type Notification = { title: string; message: string; path: string; image?: string | null; eventIds: number[] }
type PushResult = { ok: boolean; id?: string; recipients?: number; error?: string }

type Event = typeof pushEvents.$inferSelect

type EpisodeDetail = typeof episodes.$inferSelect & { seriesTitle: string; seriesSlug: string; seriesId: number; seriesCoverImageUrl: string | null }

type PostDetail = { id: number; slug: string; title: string; cover_image: string | null; published_at: string | Date | null }

export async function sendPush({ title, message, path, image, filters }: { title: string; message: string; path: string; image?: string | null; filters?: unknown[] }): Promise<PushResult> {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID
  const apiKey = process.env.ONESIGNAL_REST_API_KEY
  if (!appId || !apiKey) {
    console.warn("Push skipped: OneSignal environment variables are missing")
    return { ok: false, error: "Missing OneSignal environment variables" }
  }

  try {
    const body: Record<string, unknown> = {
      app_id: appId,
      headings: { en: title },
      contents: { en: message },
      web_url: `${BASE_URL}${path}`,
      ...(image ? { chrome_web_image: image } : {}),
      ...(filters ? { filters } : { included_segments: ["Subscribed Users"] }),
    }
    const response = await fetch("https://api.onesignal.com/notifications?c=push", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Key ${apiKey}` },
      body: JSON.stringify(body),
    })
    const data = await response.json().catch(() => ({})) as { id?: string; recipients?: number; errors?: unknown; message?: string }
    if (!response.ok || !data.id) return { ok: false, error: data.message || JSON.stringify(data.errors || `HTTP ${response.status}`) }
    return { ok: true, id: data.id, recipients: data.recipients }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) }
  }
}

export async function enqueuePushEvent(type: PushType, contentId: number): Promise<void> {
  try {
    await sql`INSERT INTO push_events (type, content_id) VALUES (${type}, ${contentId}) ON CONFLICT DO NOTHING`
  } catch (error) {
    console.error("Failed to enqueue push event", error)
  }
}

async function updateEvents(ids: number[], values: { status: string; sentAt?: Date; lastError?: string; attempts?: unknown }) {
  if (!ids.length) return
  await db.update(pushEvents).set({ status: values.status, ...(values.sentAt ? { sentAt: values.sentAt } : {}), ...(values.lastError !== undefined ? { lastError: values.lastError } : {}), ...(values.attempts !== undefined ? { attempts: values.attempts as never } : {}) }).where(inArray(pushEvents.id, ids))
}

export async function drainPushOutbox({ dry }: { dry: boolean }): Promise<{ counts: Record<string, number>; notifications: Notification[] }> {
  const events = await db.select().from(pushEvents).where(and(eq(pushEvents.status, "pending"), lt(pushEvents.createdAt, drizzleSql`now() - interval '3 minutes'`))).orderBy(asc(pushEvents.createdAt)).limit(50)
  const notifications: Notification[] = []
  const skipped = new Set<number>()
  const now = Date.now()

  const postEvents = events.filter((event) => event.type === "post")
  const postRows = postEvents.length
    ? (await Promise.all(postEvents.map((event) => sql`SELECT id, slug, title, cover_image, published_at FROM posts WHERE id = ${event.contentId} LIMIT 1`))).flat() as unknown as PostDetail[]
    : []
  const postMap = new Map(postRows.map((post) => [post.id, post]))
  const validPosts = postEvents.filter((event) => { const post = postMap.get(event.contentId); if (!post || now - new Date(post.published_at || 0).getTime() > MAX_AGE_MS) { skipped.add(event.id); return false }; return true })
  if (validPosts.length > 3) notifications.push({ title: "New on OtakuNaija", message: `${validPosts.length} new posts just dropped`, path: "/blog", eventIds: validPosts.map((event) => event.id) })
  else notifications.push(...validPosts.map((event) => ({ title: "New on OtakuNaija", message: postMap.get(event.contentId)!.title, path: `/blog/${postMap.get(event.contentId)!.slug}`, image: postMap.get(event.contentId)!.cover_image, eventIds: [event.id] })))

  const episodeEvents = events.filter((event) => event.type === "episode")
  const seriesEvents = events.filter((event) => event.type === "series")
  const episodeRows = episodeEvents.length ? await db.select({ episode: episodes, seriesTitle: series.title, seriesSlug: series.slug, seriesId: series.id, seriesCoverImageUrl: series.coverImageUrl }).from(episodes).innerJoin(series, eq(episodes.seriesId, series.id)).where(inArray(episodes.id, episodeEvents.map((event) => event.contentId))) : []
  const episodeMap = new Map(episodeRows.map((row) => [row.episode.id, { ...row.episode, seriesTitle: row.seriesTitle, seriesSlug: row.seriesSlug, seriesId: row.seriesId, seriesCoverImageUrl: row.seriesCoverImageUrl } as EpisodeDetail]))
  for (const event of episodeEvents) { const episode = episodeMap.get(event.contentId); if (!episode || now - episode.publishedAt.getTime() > MAX_AGE_MS) skipped.add(event.id) }
  for (const event of seriesEvents) { const found = await db.select({ seriesId: series.id, title: series.title, slug: series.slug, coverImageUrl: series.coverImageUrl, episodeId: episodes.id }).from(series).leftJoin(episodes, eq(episodes.seriesId, series.id)).where(eq(series.id, event.contentId)).limit(1); const item = found[0]; if (!item || !item.episodeId) { const age = now - new Date(events.find((candidate) => candidate.id === event.id)!.createdAt).getTime(); if (age > MAX_AGE_MS) skipped.add(event.id); continue } const related = episodeEvents.filter((episodeEvent) => episodeMap.get(episodeEvent.contentId)?.seriesId === event.contentId); notifications.push({ title: "New series", message: `${item.title}, now streaming`, path: `/episodes/${item.slug}`, image: item.coverImageUrl, eventIds: [event.id, ...related.map((relatedEvent) => relatedEvent.id)] }) }
  const remainingEpisodes = episodeEvents.filter((event) => !skipped.has(event.id) && !notifications.some((notification) => notification.eventIds.includes(event.id)))
  if (remainingEpisodes.length > 3) notifications.push({ title: "New episodes", message: `${remainingEpisodes.length} new episodes just dropped`, path: "/episodes/new-releases", eventIds: remainingEpisodes.map((event) => event.id) })
  else notifications.push(...remainingEpisodes.map((event) => { const episode = episodeMap.get(event.contentId)!; return { title: "New episode", message: `${episode.seriesTitle} Ep ${episode.episodeNumber} is out`, path: `/episodes/${episode.seriesSlug}/${episode.slug}`, image: episode.thumbnailUrl, eventIds: [event.id] } }))

  const selected = notifications.slice(0, MAX_NOTIFICATIONS)
  if (dry) return { counts: { pending: events.length, skipped: skipped.size, wouldSend: selected.length }, notifications: selected }
  await updateEvents([...skipped], { status: "skipped" })
  let sent = 0; let failed = 0
  for (const notification of selected) { const result = await sendPush(notification); if (result.ok && result.id) { await updateEvents(notification.eventIds, { status: "sent", sentAt: new Date() }); sent++ } else if (result.error?.includes("not subscribed")) { await db.update(pushEvents).set({ lastError: "no subscribers yet", status: "pending" }).where(inArray(pushEvents.id, notification.eventIds)); break } else { failed++; await db.update(pushEvents).set({ attempts: drizzleSql`${pushEvents.attempts} + 1`, lastError: result.error || "Unknown push failure", status: drizzleSql`CASE WHEN ${pushEvents.attempts} + 1 >= 3 THEN 'failed' ELSE 'pending' END` }).where(inArray(pushEvents.id, notification.eventIds)) } }
  return { counts: { pending: events.length - skipped.size - selected.reduce((count, notification) => count + notification.eventIds.length, 0), skipped: skipped.size, sent, failed }, notifications: selected }
}
