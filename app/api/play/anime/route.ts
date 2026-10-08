import { eq, isNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { creators, series } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'
import { uniqueSlug } from '@/lib/play-slugs'
import { enqueuePushEvent } from '@/lib/push'

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

function mapStatus(rawStatus: unknown): string {
  if (typeof rawStatus !== 'string') return 'ongoing'
  const normalized = rawStatus.trim().toLowerCase()
  if (normalized === 'currently airing') return 'ongoing'
  if (normalized === 'finished airing') return 'completed'
  if (normalized === 'not yet aired') return 'ongoing'
  return 'ongoing'
}

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

    const existing = await db.select({ id: series.id }).from(series).where(eq(series.anilistId, body.anilistId)).limit(1)
    if (existing[0]) return Response.json({ seriesId: existing[0].id })

    const titleMatch = await db
      .select({ id: series.id })
      .from(series)
      .where(sql`${isNull(series.anilistId)} AND LOWER(${series.title}) = LOWER(${body.title})`)
      .limit(1)

    if (titleMatch[0]) {
      try {
        await db.update(series).set({ anilistId: body.anilistId }).where(eq(series.id, titleMatch[0].id))
        return Response.json({ seriesId: titleMatch[0].id })
      } catch (error) {
        if (!isUniqueViolation(error)) throw error
        const raced = await db.select({ id: series.id }).from(series).where(eq(series.anilistId, body.anilistId)).limit(1)
        if (!raced[0]) throw error
        return Response.json({ seriesId: raced[0].id })
      }
    }

    const creatorId = await resolveCreator(body.studioName ?? null)
    const slug = await uniqueSlug(body.title, series, series.slug)
    const genres = Array.isArray(body.genres) && body.genres.length > 0 ? body.genres.join(', ') : null
    const values: any = {
      creatorId,
      title: body.title,
      slug,
      synopsis: body.description ?? null,
      coverImageUrl: body.bannerUrl ?? body.coverUrl ?? null,
      posterImageUrl: body.posterUrl ?? body.coverUrl ?? null,
      status: mapStatus(body.status),
      genre: genres,
      anilistId: body.anilistId,
    }
    if (typeof body.releaseYear === 'number') values.createdAt = new Date(Date.UTC(body.releaseYear, 0, 1))

    try {
      const inserted = await db.insert(series).values(values).returning({ id: series.id })
      void enqueuePushEvent("series", inserted[0].id).catch(() => {})
      return Response.json({ seriesId: inserted[0].id }, { status: 201 })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await db.select({ id: series.id }).from(series).where(eq(series.anilistId, body.anilistId)).limit(1)
      if (!raced[0]) throw error
      return Response.json({ seriesId: raced[0].id })
    }
  } catch (error) {
    console.error('[play/anime] ingest failed', error)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
