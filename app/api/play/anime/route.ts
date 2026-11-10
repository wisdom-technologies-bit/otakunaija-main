import { eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { creators, series } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'
import { uniqueSlug } from '@/lib/play-slugs'
import { enqueuePushEvent } from '@/lib/push'
import {
  buildCreateValues,
  buildUpdatePatch,
  shouldEnqueuePush,
  type PlayAnimePayload,
} from '@/lib/play-anime'

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
}

async function resolveCreator(studioName: string | null) {
  const name = studioName?.trim()
  if (!name) {
    const existing = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, 'unknown-studio')).limit(1)
    if (existing[0]) return existing[0].id
    try {
      const inserted = await db.insert(creators).values({ name: 'Unknown Studio', slug: 'unknown-studio' }).returning({ id: creators.id })
      return inserted[0].id
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await db.select({ id: creators.id }).from(creators).where(eq(creators.slug, 'unknown-studio')).limit(1)
      if (!raced[0]) throw error
      return raced[0].id
    }
  }

  const existing = await db.select({ id: creators.id }).from(creators).where(eq(creators.name, name)).limit(1)
  if (existing[0]) return existing[0].id

  const slug = await uniqueSlug(name, creators, creators.slug)
  try {
    const inserted = await db.insert(creators).values({ name, slug }).returning({ id: creators.id })
    return inserted[0].id
  } catch (error) {
    if (!isUniqueViolation(error)) throw error
    const raced = await db.select({ id: creators.id }).from(creators).where(eq(creators.name, name)).limit(1)
    if (!raced[0]) throw error
    return raced[0].id
  }
}

/** A row we have seen before, in the shape the update rules need. */
async function loadExisting(anilistId: number) {
  const rows = await db
    .select({ id: series.id, status: series.status, titleChecked: series.titleChecked, isPlaceholder: series.isPlaceholder })
    .from(series)
    .where(eq(series.anilistId, anilistId))
    .limit(1)
  return rows[0] ?? null
}

/**
 * Anime ingest for the play service.
 *
 * The contract is unchanged for old callers: same `x-play-api-key` auth, same
 * `{ seriesId }` body, 201 on a new row. On top of it:
 *  - the upcoming-release metadata is accepted and stored;
 *  - an existing series is refreshed instead of being returned untouched, but a
 *    checked title is never overwritten and the status only moves
 *    upcoming -> ongoing and ongoing -> completed;
 *  - `created` / `updated` describe what happened;
 *  - a push event is only enqueued when the series is actually airing, never
 *    for a not-yet-released placeholder.
 */
export async function POST(request: Request) {
  if (!hasValidPlayApiKey(request)) return unauthorizedResponse()

  try {
    let body: any
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    if (typeof body?.anilistId !== 'number' || typeof body?.title !== 'string' || !body.title.trim()) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    const payload = body as PlayAnimePayload

    const existing = await loadExisting(payload.anilistId)
    if (existing) return refreshSeries(existing, payload)

    const titleMatch = await db
      .select({ id: series.id, status: series.status, titleChecked: series.titleChecked, isPlaceholder: series.isPlaceholder })
      .from(series)
      .where(sql`${isNull(series.anilistId)} AND LOWER(${series.title}) = LOWER(${payload.title})`)
      .limit(1)

    if (titleMatch[0]) {
      try {
        await db.update(series).set({ anilistId: payload.anilistId }).where(eq(series.id, titleMatch[0].id))
        return refreshSeries(titleMatch[0], payload)
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const raced = await loadExisting(payload.anilistId)
        if (!raced) throw error
        return refreshSeries(raced, payload)
      }
    }

    const creatorId = await resolveCreator(payload.studioName ?? null)
    const slug = await uniqueSlug(payload.title, series, series.slug)
    const values = buildCreateValues(payload, creatorId, slug)

    try {
      const inserted = await db.insert(series).values(values).returning({ id: series.id })
      const seriesId = inserted[0].id
      if (shouldEnqueuePush(values.status ?? null, values.isPlaceholder)) {
        void enqueuePushEvent('series', seriesId).catch(() => {})
      }
      return Response.json({ seriesId, created: true, updated: false }, { status: 201 })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await loadExisting(payload.anilistId)
      if (!raced) throw error
      return refreshSeries(raced, payload)
    }
  } catch (error) {
    console.error('[play/anime] ingest failed', error)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}

async function refreshSeries(
  existing: { id: number; status: string | null; titleChecked: boolean; isPlaceholder: boolean },
  payload: PlayAnimePayload,
) {
  const { patch, statusChanged, becameOngoing } = buildUpdatePatch(existing, payload)

  if (Object.keys(patch).length > 0) {
    await db.update(series).set(patch).where(eq(series.id, existing.id))
    if (becameOngoing) void enqueuePushEvent('series', existing.id).catch(() => {})
  }

  return Response.json({
    seriesId: existing.id,
    created: false,
    updated: Object.keys(patch).length > 0,
  })
}
