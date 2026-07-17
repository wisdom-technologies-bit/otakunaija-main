import { db } from './index'
import { creators, series, episodes } from './schema'
import { eq, asc, desc, and, lt, gt } from 'drizzle-orm'

// Get all series with their creators
export async function getAllSeriesWithCreators() {
  return db
    .select({
      series: series,
      creator: creators,
    })
    .from(series)
    .leftJoin(creators, eq(series.creatorId, creators.id))
    .orderBy(desc(series.createdAt))
}

// Get one series by slug with creator and all episodes
export async function getSeriesBySlugWithEpisodes(slug: string) {
  const result = await db
    .select({
      series: series,
      creator: creators,
      episodes: episodes,
    })
    .from(series)
    .leftJoin(creators, eq(series.creatorId, creators.id))
    .leftJoin(episodes, eq(series.id, episodes.seriesId))
    .where(eq(series.slug, slug))
    .orderBy(asc(episodes.episodeNumber))

  if (result.length === 0) {
    return null
  }

  // Group episodes by series
  const seriesData = result[0].series
  const creatorData = result[0].creator
  const episodesData = result
    .map((r) => r.episodes)
    .filter((ep) => ep !== null)

  return {
    series: seriesData,
    creator: creatorData,
    episodes: episodesData,
  }
}

// Get one episode by slug with series and creator info
export async function getEpisodeBySlugWithContext(episodeSlug: string) {
  const result = await db
    .select({
      episode: episodes,
      series: series,
      creator: creators,
    })
    .from(episodes)
    .leftJoin(series, eq(episodes.seriesId, series.id))
    .leftJoin(creators, eq(series.creatorId, creators.id))
    .where(eq(episodes.slug, episodeSlug))
    .limit(1)

  if (result.length === 0) {
    return null
  }

  return result[0]
}

// Get previous and next episode in the same series
export async function getPreviousAndNextEpisode(
  seriesId: number,
  episodeNumber: number
) {
  const [prevEp] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.seriesId, seriesId), lt(episodes.episodeNumber, episodeNumber)))
    .orderBy(desc(episodes.episodeNumber))
    .limit(1)

  const [nextEp] = await db
    .select()
    .from(episodes)
    .where(and(eq(episodes.seriesId, seriesId), gt(episodes.episodeNumber, episodeNumber)))
    .orderBy(asc(episodes.episodeNumber))
    .limit(1)

  return { previous: prevEp, next: nextEp }
}

// Get all episodes in a series ordered by episode number
export async function getEpisodesBySeries(seriesId: number) {
  return db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))
    .orderBy(asc(episodes.episodeNumber))
}

// Get episode count for a series
export async function getSeriesEpisodeCount(seriesId: number) {
  const result = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))

  return result.length
}

// ============ ADMIN QUERY FUNCTIONS ============

// Creators
export async function getAllCreators() {
  return db.select().from(creators).orderBy(desc(creators.createdAt))
}

export async function getCreatorById(id: number) {
  const result = await db.select().from(creators).where(eq(creators.id, id)).limit(1)
  return result[0] || null
}

export async function getCreatorBySlug(slug: string) {
  const result = await db.select().from(creators).where(eq(creators.slug, slug)).limit(1)
  return result[0] || null
}

export async function getSeriesCountForCreator(creatorId: number) {
  const result = await db
    .select()
    .from(series)
    .where(eq(series.creatorId, creatorId))
  return result.length
}

export type CreateCreatorInput = {
  name: string
  slug?: string
  bio?: string | null
  avatar_url?: string | null
  facebook_url?: string | null
}

export type UpdateCreatorInput = CreateCreatorInput & { id: number }

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 200)
}

export async function ensureUniqueCreatorSlug(base: string, excludeId?: number): Promise<string> {
  let slug = slugify(base) || `creator-${Date.now()}`
  let n = 1
  while (true) {
    const result = excludeId
      ? await db
          .select()
          .from(creators)
          .where(and(eq(creators.slug, slug), eq(creators.id, excludeId)))
          .limit(1)
      : await db.select().from(creators).where(eq(creators.slug, slug)).limit(1)
    if (result.length === 0) return slug
    n += 1
    slug = `${slugify(base)}-${n}`
  }
}

export async function createCreator(input: CreateCreatorInput) {
  const slug = await ensureUniqueCreatorSlug(input.slug || input.name)
  const result = await db
    .insert(creators)
    .values({
      name: input.name,
      slug,
      bio: input.bio || null,
      avatarUrl: input.avatar_url || null,
      facebookUrl: input.facebook_url || null,
    })
    .returning()
  return result[0]
}

export async function updateCreator(input: UpdateCreatorInput) {
  const slug = input.slug ? await ensureUniqueCreatorSlug(input.slug, input.id) : undefined
  const result = await db
    .update(creators)
    .set({
      name: input.name,
      slug: slug || input.slug,
      bio: input.bio,
      avatarUrl: input.avatar_url,
      facebookUrl: input.facebook_url,
    })
    .where(eq(creators.id, input.id))
    .returning()
  return result[0]
}

export async function deleteCreator(id: number) {
  // Check if creator has series
  const seriesCount = await getSeriesCountForCreator(id)
  if (seriesCount > 0) {
    throw new Error(
      `Cannot delete creator that has ${seriesCount} series. Delete or reassign those series first.`
    )
  }
  await db.delete(creators).where(eq(creators.id, id))
}

// Series
export async function getAllSeriesForAdmin() {
  return db
    .select({
      series,
      creator: creators,
    })
    .from(series)
    .leftJoin(creators, eq(series.creatorId, creators.id))
    .orderBy(desc(series.createdAt))
}

export async function getSeriesById(id: number) {
  const result = await db.select().from(series).where(eq(series.id, id)).limit(1)
  return result[0] || null
}

export async function getEpisodesCountForSeries(seriesId: number) {
  const result = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))
  return result.length
}

export type CreateSeriesInput = {
  creator_id: number
  title: string
  slug?: string
  synopsis?: string | null
  cover_image_url?: string | null
  status?: 'ongoing' | 'completed'
  genre?: string | null
}

export type UpdateSeriesInput = CreateSeriesInput & { id: number }

export async function ensureUniqueSeriesSlug(base: string, excludeId?: number): Promise<string> {
  let slug = slugify(base) || `series-${Date.now()}`
  let n = 1
  while (true) {
    const result = excludeId
      ? await db
          .select()
          .from(series)
          .where(and(eq(series.slug, slug), eq(series.id, excludeId)))
          .limit(1)
      : await db.select().from(series).where(eq(series.slug, slug)).limit(1)
    if (result.length === 0) return slug
    n += 1
    slug = `${slugify(base)}-${n}`
  }
}

export async function createSeries(input: CreateSeriesInput) {
  const slug = await ensureUniqueSeriesSlug(input.slug || input.title)
  const result = await db
    .insert(series)
    .values({
      creatorId: input.creator_id,
      title: input.title,
      slug,
      synopsis: input.synopsis || null,
      coverImageUrl: input.cover_image_url || null,
      status: input.status || 'ongoing',
      genre: input.genre || null,
    })
    .returning()
  return result[0]
}

export async function updateSeries(input: UpdateSeriesInput) {
  const slug = input.slug ? await ensureUniqueSeriesSlug(input.slug, input.id) : undefined
  const result = await db
    .update(series)
    .set({
      creatorId: input.creator_id,
      title: input.title,
      slug: slug || input.slug,
      synopsis: input.synopsis,
      coverImageUrl: input.cover_image_url,
      status: input.status,
      genre: input.genre,
    })
    .where(eq(series.id, input.id))
    .returning()
  return result[0]
}

export async function deleteSeries(id: number) {
  // Check if series has episodes
  const episodeCount = await getEpisodesCountForSeries(id)
  if (episodeCount > 0) {
    throw new Error(
      `Cannot delete series that has ${episodeCount} episodes. Delete those episodes first.`
    )
  }
  await db.delete(series).where(eq(series.id, id))
}

// Episodes
export async function getAllEpisodesForAdmin() {
  return db
    .select({
      episode: episodes,
      series: series,
    })
    .from(episodes)
    .leftJoin(series, eq(episodes.seriesId, series.id))
    .orderBy(desc(episodes.publishedAt))
}

export async function getEpisodeById(id: number) {
  const result = await db.select().from(episodes).where(eq(episodes.id, id)).limit(1)
  return result[0] || null
}

export type CreateEpisodeInput = {
  series_id: number
  episode_number: number
  title: string
  slug?: string
  synopsis?: string | null
  video_public_id: string
  video_url: string
  thumbnail_url: string
  duration_seconds?: number | null
}

export type UpdateEpisodeInput = CreateEpisodeInput & { id: number }

export async function ensureUniqueEpisodeSlug(base: string, excludeId?: number): Promise<string> {
  let slug = slugify(base) || `episode-${Date.now()}`
  let n = 1
  while (true) {
    const result = excludeId
      ? await db
          .select()
          .from(episodes)
          .where(and(eq(episodes.slug, slug), eq(episodes.id, excludeId)))
          .limit(1)
      : await db.select().from(episodes).where(eq(episodes.slug, slug)).limit(1)
    if (result.length === 0) return slug
    n += 1
    slug = `${slugify(base)}-${n}`
  }
}

export async function createEpisode(input: CreateEpisodeInput) {
  const slug = await ensureUniqueEpisodeSlug(input.slug || input.title)
  const result = await db
    .insert(episodes)
    .values({
      seriesId: input.series_id,
      episodeNumber: input.episode_number,
      title: input.title,
      slug,
      synopsis: input.synopsis || null,
      video_public_id: input.video_public_id,
      video_url: input.video_url,
      thumbnail_url: input.thumbnail_url,
      duration_seconds: input.duration_seconds || null,
    })
    .returning()
  return result[0]
}

export async function updateEpisode(input: UpdateEpisodeInput) {
  const slug = input.slug ? await ensureUniqueEpisodeSlug(input.slug, input.id) : undefined
  const result = await db
    .update(episodes)
    .set({
      seriesId: input.series_id,
      episodeNumber: input.episode_number,
      title: input.title,
      slug: slug || input.slug,
      synopsis: input.synopsis,
      video_public_id: input.video_public_id,
      video_url: input.video_url,
      thumbnail_url: input.thumbnail_url,
      duration_seconds: input.duration_seconds,
    })
    .where(eq(episodes.id, input.id))
    .returning()
  return result[0]
}

export async function deleteEpisode(id: number) {
  await db.delete(episodes).where(eq(episodes.id, id))
}
