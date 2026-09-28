import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { episodes, series } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'
import { uniqueSlug } from '@/lib/play-slugs'

function isUniqueViolation(error: unknown) {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === '23505'
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

    if (typeof body?.anilistId !== 'number' || typeof body?.episodeNumber !== 'number' || typeof body?.playId !== 'string' || !body.playId.trim()) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    const seriesRow = (await db.select().from(series).where(eq(series.anilistId, body.anilistId)).limit(1))[0]
    if (!seriesRow) return Response.json({ error: 'ANIME_NOT_FOUND' }, { status: 404 })

    const existing = (await db.select().from(episodes).where(eq(episodes.playId, body.playId)).limit(1))[0]
    const updates: any = {}
    if (typeof body.title === 'string' && body.title.trim()) updates.title = body.title
    if (body.description !== null && body.description !== undefined) updates.synopsis = body.description
    if (typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim()) updates.thumbnailUrl = body.thumbnailUrl
    if (body.duration !== null && body.duration !== undefined) updates.durationSeconds = body.duration * 60
    if (body.airDate !== null && body.airDate !== undefined) updates.publishedAt = new Date(body.airDate)

    if (existing) {
      const updated = await db.update(episodes).set(updates).where(eq(episodes.id, existing.id)).returning({ id: episodes.id })
      return Response.json({ episodeId: updated[0].id, seriesId: seriesRow.id })
    }

    const title = typeof body.title === 'string' && body.title.trim() ? body.title : `Episode ${body.episodeNumber}`
    const thumbnailUrl = typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim()
      ? body.thumbnailUrl
      : seriesRow.coverImageUrl?.trim() || 'https://placehold.co/400x225?text=No+Thumbnail'
    const slug = await uniqueSlug(title, episodes, episodes.slug)
    const values: any = {
      seriesId: seriesRow.id,
      episodeNumber: body.episodeNumber,
      title,
      slug,
      synopsis: body.description ?? null,
      videoPublicId: null,
      videoUrl: null,
      thumbnailUrl,
      durationSeconds: body.duration !== null && body.duration !== undefined ? body.duration * 60 : null,
      subtitlesUrl: null,
      playId: body.playId,
    }
    if (body.airDate !== null && body.airDate !== undefined) values.publishedAt = new Date(body.airDate)

    try {
      const inserted = await db.insert(episodes).values(values).returning({ id: episodes.id })
      return Response.json({ episodeId: inserted[0].id, seriesId: seriesRow.id }, { status: 201 })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = (await db.select({ id: episodes.id, seriesId: episodes.seriesId }).from(episodes).where(eq(episodes.playId, body.playId)).limit(1))[0]
      if (!raced) throw error
      return Response.json({ episodeId: raced.id, seriesId: raced.seriesId })
    }
  } catch (error) {
    console.error('[play/episodes] ingest failed', error)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
