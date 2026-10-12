import { eq } from 'drizzle-orm'
import { db } from '@/lib/db/index'
import { videos } from '@/lib/db/schema'
import { hasValidPlayApiKey, unauthorizedResponse } from '@/lib/play-auth'
import { resolvePlayCreator } from '@/lib/play-creator'
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

    const contentType = typeof body?.contentType === 'string' ? body.contentType.trim().toLowerCase() : ''
    if (
      typeof body?.anilistId !== 'number' ||
      typeof body?.title !== 'string' ||
      !body.title.trim() ||
      !['movie', 'ova', 'special'].includes(contentType) ||
      typeof body?.playId !== 'string' ||
      !body.playId.trim()
    ) {
      return Response.json({ error: 'INVALID_BODY' }, { status: 400 })
    }

    const existing = await db.select({ id: videos.id }).from(videos).where(eq(videos.anilistId, body.anilistId)).limit(1)
    if (existing[0]) return Response.json({ videoId: existing[0].id })

    const creatorId = await resolvePlayCreator(body.studioName ?? null)
    const title = typeof body.episodeTitle === 'string' && body.episodeTitle.trim() ? body.episodeTitle.trim() : body.title.trim()
    const synopsis = typeof body.episodeDescription === 'string' && body.episodeDescription.trim()
      ? body.episodeDescription
      : body.description ?? null
    const slug = await uniqueSlug(title, videos, videos.slug)
    const genres = Array.isArray(body.genres) && body.genres.length > 0 ? body.genres.join(', ') : null
    const thumbnailUrl = typeof body.thumbnailUrl === 'string' && body.thumbnailUrl.trim()
      ? body.thumbnailUrl
      : typeof body.coverUrl === 'string' && body.coverUrl.trim()
        ? body.coverUrl
        : 'https://placehold.co/400x225?text=No+Thumbnail'
    const values: any = {
      title,
      slug,
      contentType,
      synopsis,
      posterImageUrl: body.coverUrl ?? null,
      coverImageUrl: body.coverUrl ?? null,
      thumbnailUrl,
      creatorId,
      parentSeriesId: null,
      genre: genres,
      status: body.status ?? 'ongoing',
      durationSeconds: body.duration !== null && body.duration !== undefined ? body.duration * 60 : null,
      videoPublicId: null,
      videoUrl: null,
      subtitlesUrl: null,
      playId: body.playId,
      anilistId: body.anilistId,
      malId: body.malId ?? null,
    }
    if (body.airDate !== null && body.airDate !== undefined) values.publishedAt = new Date(body.airDate)

    try {
      const inserted = await db.insert(videos).values(values).returning({ id: videos.id })
      return Response.json({ videoId: inserted[0].id }, { status: 201 })
    } catch (error) {
      if (!isUniqueViolation(error)) throw error
      const raced = await db.select({ id: videos.id }).from(videos).where(eq(videos.anilistId, body.anilistId)).limit(1)
      if (!raced[0]) throw error
      return Response.json({ videoId: raced[0].id })
    }
  } catch (error) {
    console.error('[play/videos] ingest failed', error)
    return Response.json({ error: 'INTERNAL_ERROR' }, { status: 500 })
  }
}
