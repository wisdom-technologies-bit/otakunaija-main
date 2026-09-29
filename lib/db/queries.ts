import { cache } from 'react'
import { unstable_cache } from 'next/cache'
import { db } from './index'
import { creators, series, episodes, postViews, episodeViews, episodeWatchPings } from './schema'
import { eq, asc, desc, and, lt, gt, sql, count } from 'drizzle-orm'

// Get all series with all their episodes, for sitemap generation
const _getAllSeriesWithEpisodesForSitemap = cache(
  unstable_cache(
    async () => {
      const result = await db
        .select({
          series: series,
          episode: episodes,
        })
        .from(series)
        .leftJoin(episodes, eq(series.id, episodes.seriesId))

      const seriesMap = new Map<number, { title: string; slug: string; episodes: { title: string; slug: string; publishedAt: Date | null }[] }>()

      for (const row of result) {
        if (!seriesMap.has(row.series.id)) {
          seriesMap.set(row.series.id, { title: row.series.title, slug: row.series.slug, episodes: [] })
        }
        if (row.episode) {
          seriesMap.get(row.series.id)!.episodes.push({
title: row.episode.title,
  slug: row.episode.slug,
  publishedAt: row.episode.publishedAt,
          })
        }
      }

      return Array.from(seriesMap.values())
    },
    ['series-episodes-sitemap'],
    { revalidate: 86400, tags: ['sitemap'] }
  )
)

export async function getAllSeriesWithEpisodesForSitemap() {
  return _getAllSeriesWithEpisodesForSitemap()
}

// Get all series with their creators
const _getAllSeriesWithCreators = cache(
  unstable_cache(
    async () => {
      return db
        .select({
          series: series,
          creator: creators,
        })
        .from(series)
        .leftJoin(creators, eq(series.creatorId, creators.id))
        .orderBy(desc(series.createdAt))
    },
    ['all-series-creators'],
    { revalidate: 3600, tags: ['series'] }
  )
)

export async function getAllSeriesWithCreators() {
  return _getAllSeriesWithCreators()
}

// Get one series by slug with creator and all episodes
const _getSeriesBySlugWithEpisodes = cache(
  unstable_cache(
    async (slug: string) => {
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
    },
    ['series-by-slug'],
    { revalidate: 3600, tags: ['series'] }
  )
)

export async function getSeriesBySlugWithEpisodes(slug: string) {
  return _getSeriesBySlugWithEpisodes(slug)
}

// Get one episode by slug with series and creator info
const _getEpisodeBySlugWithContext = cache(
  unstable_cache(
    async (episodeSlug: string) => {
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
    },
    ['episode-by-slug'],
    { revalidate: 7200, tags: ['episodes'] }
  )
)

export async function getEpisodeBySlugWithContext(episodeSlug: string) {
  return _getEpisodeBySlugWithContext(episodeSlug)
}

// Get previous and next episode in the same series
const _getPreviousAndNextEpisode = cache(
  unstable_cache(
    async (seriesId: number, episodeNumber: number) => {
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
    },
    ['episode-navigation'],
    { revalidate: 3600, tags: ['episodes'] }
  )
)

export async function getPreviousAndNextEpisode(
  seriesId: number,
  episodeNumber: number
) {
  return _getPreviousAndNextEpisode(seriesId, episodeNumber)
}

// Get all episodes in a series ordered by episode number
const _getEpisodesBySeries = cache(
  unstable_cache(
    async (seriesId: number) => {
      return db
        .select()
        .from(episodes)
        .where(eq(episodes.seriesId, seriesId))
        .orderBy(asc(episodes.episodeNumber))
    },
    ['episodes-by-series'],
    { revalidate: 3600, tags: ['episodes'] }
  )
)

export async function getEpisodesBySeries(seriesId: number) {
  return _getEpisodesBySeries(seriesId)
}

// Get the N most recently published episodes across ALL series, with series+creator context
// Used for the "New Releases" section on /episodes and its "View All" page
const _getRecentEpisodesAcrossAllSeries = cache(
  unstable_cache(
    async (limit: number, offset: number) => {
      return db
        .select({
          episode: episodes,
          series: series,
          creator: creators,
        })
        .from(episodes)
        .leftJoin(series, eq(episodes.seriesId, series.id))
        .leftJoin(creators, eq(series.creatorId, creators.id))
        .orderBy(desc(episodes.publishedAt))
        .limit(limit)
        .offset(offset)
    },
    ['recent-episodes'],
    { revalidate: 1800, tags: ['episodes-recent'] }
  )
)

export async function getRecentEpisodesAcrossAllSeries(limit = 10, offset = 0) {
  return _getRecentEpisodesAcrossAllSeries(limit, offset)
}

// Get all series with a given status ("ongoing" or "completed"), with creator context —
// used for the continuously-scrolling "Ongoing Series" row
const _getSeriesByStatus = cache(
  unstable_cache(
    async (status: 'ongoing' | 'completed') => {
      return db
        .select({
          series: series,
          creator: creators,
        })
        .from(series)
        .leftJoin(creators, eq(series.creatorId, creators.id))
        .where(eq(series.status, status))
        .orderBy(desc(series.createdAt))
    },
    ['series-by-status'],
    { revalidate: 3600, tags: ['series'] }
  )
)

export async function getSeriesByStatus(status: 'ongoing' | 'completed') {
  return _getSeriesByStatus(status)
}

// Get all series filtered by genre, with creator context — used for the genre filter pills
const _getSeriesByGenre = cache(
  unstable_cache(
    async (genre: string) => {
      return db
        .select({
          series: series,
          creator: creators,
        })
        .from(series)
        .leftJoin(creators, eq(series.creatorId, creators.id))
        .where(eq(series.genre, genre))
        .orderBy(desc(series.createdAt))
    },
    ['series-by-genre'],
    { revalidate: 3600, tags: ['series'] }
  )
)

export async function getSeriesByGenre(genre: string) {
  return _getSeriesByGenre(genre)
}

// Get the top N series by total views across their episodes — used for "Trending Now" on /episodes.
// Since series itself has no view_count column, this sums each series' episodes' view counts.
const _getTrendingSeries = cache(
  unstable_cache(
    async (limit: number) => {
      const result = await db
        .select({
          series: series,
          creator: creators,
          totalViews: sql<number>`COALESCE(SUM(${episodes.viewCount}), 0)`.as('total_views'),
        })
        .from(series)
        .leftJoin(creators, eq(series.creatorId, creators.id))
        .leftJoin(episodes, eq(series.id, episodes.seriesId))
        .groupBy(series.id, creators.id)
        .orderBy(desc(sql`total_views`))
        .limit(limit)

      return result
    },
    ['trending-series'],
    { revalidate: 3600, tags: ['episodes-trending'] }
  )
)

export async function getTrendingSeries(limit = 5) {
  return _getTrendingSeries(limit)
}

// Get every distinct genre currently in use across all series — used to build the filter pills
// dynamically instead of hardcoding a genre list that may not match what's actually in the database
const _getAllUsedGenres = cache(
  unstable_cache(
    async () => {
      const result = await db
        .selectDistinct({ genre: series.genre })
        .from(series)
        .where(sql`${series.genre} IS NOT NULL`)

      return result.map((r) => r.genre).filter((g): g is string => g !== null)
    },
    ['all-genres'],
    { revalidate: 86400, tags: ['series'] }
  )
)

export async function getAllUsedGenres() {
  return _getAllUsedGenres()
}

export async function getPaginatedSeries({
  page = 1,
  pageSize = 24,
  status,
  genre,
  sort = 'newest',
}: {
  page?: number
  pageSize?: number
  status?: string
  genre?: string
  sort?: 'newest' | 'title'
}) {
  const filters = []
  if (status && ['ongoing', 'completed', 'upcoming'].includes(status)) filters.push(eq(series.status, status))
  if (genre) filters.push(sql`(',' || COALESCE(${series.genre}, '') || ',') ILIKE ${`%,${genre},%`}`)
  const where = filters.length ? and(...filters) : undefined
  const offset = Math.max(0, page - 1) * pageSize
  const [items, [{ total }]] = await Promise.all([
    db.select({ series, creator: creators }).from(series).leftJoin(creators, eq(series.creatorId, creators.id)).where(where)
      .orderBy(sort === 'title' ? asc(series.title) : desc(series.createdAt)).limit(pageSize).offset(offset),
    db.select({ total: count() }).from(series).where(where),
  ])
  return { items, total: Number(total), page, pageSize, totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) }
}

export async function getPaginatedNewEpisodes(page = 1, pageSize = 24) {
  const offset = Math.max(0, page - 1) * pageSize
  const [items, [{ total }]] = await Promise.all([
    db.select({ episode: episodes, series, creator: creators }).from(episodes).leftJoin(series, eq(episodes.seriesId, series.id)).leftJoin(creators, eq(series.creatorId, creators.id)).orderBy(desc(episodes.publishedAt)).limit(pageSize).offset(offset),
    db.select({ total: count() }).from(episodes),
  ])
  return { items, total: Number(total), page, pageSize, totalPages: Math.max(1, Math.ceil(Number(total) / pageSize)) }
}

// Search episodes and series by query
export async function searchEpisodesAndSeries(query: string) {
  const searchLike = `%${query}%`

  // Search series
  const seriesResults = await db
    .select()
    .from(series)
    .where(sql`${series.title} ILIKE ${searchLike} OR ${series.synopsis} ILIKE ${searchLike}`)
    .orderBy(desc(series.createdAt))

  // Search episodes
  const episodesResults = await db
    .select({
      episode: episodes,
      series: series,
    })
    .from(episodes)
    .leftJoin(series, eq(episodes.seriesId, series.id))
    .where(sql`${episodes.title} ILIKE ${searchLike} OR ${episodes.synopsis} ILIKE ${searchLike}`)
    .orderBy(desc(episodes.publishedAt))

  return { seriesResults, episodesResults }
}

// Smarter search: splits the query into words and matches series title,
// episode title, and episode number independently, so a query like
// "One Piece Episode 1170" correctly finds series "One Piece" episode 1170
// even though no single field contains that literal phrase
export async function searchEpisodesAndSeriesSmart(query: string) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  // Pull out any word that's purely numeric — treat it as a possible episode number
  const numericWords = words.filter((w) => /^\d+$/.test(w))
  // Remaining words (ignoring generic words like "episode"/"ep") form the text query
  const textWords = words.filter(
    (w) => !/^\d+$/.test(w) && !/^ep(isode)?s?$/i.test(w)
  )
  const textQuery = textWords.join(' ')
  const textLike = `%${textQuery}%`

  // Series matching: title or synopsis contains the text portion of the query
  const seriesResults = textQuery
    ? await db
      .select()
      .from(series)
      .where(sql`${series.title} ILIKE ${textLike} OR ${series.synopsis} ILIKE ${textLike}`)
      .orderBy(desc(series.createdAt))
    : []

  // Episode matching: title/synopsis matches the text portion,
  // OR the episode number matches any numeric word in the query,
  // OR the episode's parent series title matches the text portion
  // (this last part is what makes "One Piece Episode 1170" work)
  const episodesResults = await db
    .select({
      episode: episodes,
      series: series,
    })
    .from(episodes)
    .leftJoin(series, eq(episodes.seriesId, series.id))
    .where(
      sql`
        (${textQuery ? sql`${episodes.title} ILIKE ${textLike} OR ${episodes.synopsis} ILIKE ${textLike} OR ${series.title} ILIKE ${textLike}` : sql`FALSE`})
        ${numericWords.length > 0 ? sql`OR ${episodes.episodeNumber} IN (${sql.join(numericWords.map((n) => sql`${parseInt(n, 10)}`), sql`, `)})` : sql``}
      `
    )
    .orderBy(desc(episodes.publishedAt))

  // If both a series-name match AND a specific episode number were given,
  // prioritize episodes whose series actually matches that text too —
  // this filters out coincidental episode-number matches from unrelated series
  const refinedEpisodesResults =
    textQuery && numericWords.length > 0
      ? episodesResults.filter(
        (r) =>
          r.series &&
          (r.series.title.toLowerCase().includes(textQuery.toLowerCase()) ||
            numericWords.includes(r.episode.episodeNumber.toString()))
      )
      : episodesResults

  return { seriesResults, episodesResults: refinedEpisodesResults }
}

// Get episode count for a series
export async function getSeriesEpisodeCount(seriesId: number) {
  const result = await db
    .select()
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))

  return result.length
}

// Get the latest (max) episode number for a series
export async function getLatestEpisodeNumber(seriesId: number) {
  const result = await db
    .select({ maxEpisode: sql<number>`MAX(${episodes.episodeNumber})` })
    .from(episodes)
    .where(eq(episodes.seriesId, seriesId))

  return result[0]?.maxEpisode ?? 0
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
  poster_image_url?: string | null
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
      posterImageUrl: input.poster_image_url || null,
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
      posterImageUrl: input.poster_image_url,
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
  subtitles_url?: string | null
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
      videoPublicId: input.video_public_id,
      videoUrl: input.video_url,
      thumbnailUrl: input.thumbnail_url,
      durationSeconds: input.duration_seconds || null,
      subtitlesUrl: input.subtitles_url || null,
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
      videoPublicId: input.video_public_id,
      videoUrl: input.video_url,
      thumbnailUrl: input.thumbnail_url,
      durationSeconds: input.duration_seconds,
      subtitlesUrl: input.subtitles_url,
    })
    .where(eq(episodes.id, input.id))
    .returning()
  return result[0]
}

export async function deleteEpisode(id: number) {
  await db.delete(episodes).where(eq(episodes.id, id))
}

// ============ VIEW TRACKING ============

// Record a post view for a device
export async function recordPostView(postId: number, deviceId: string) {
  try {
    await db
      .insert(postViews)
      .values({
        postId,
        deviceId,
        viewedAt: new Date(),
      })

    // Increment post view count
    // This is a simplified approach - in production with actual posts table this would be more complex
  } catch (err) {
    console.error('Error recording post view:', err)
  }
}

// Record an episode view for a device
export async function recordEpisodeView(episodeId: number, deviceId: string) {
  try {
    const result = await db
      .insert(episodeViews)
      .values({
        episodeId,
        deviceId,
      })
      .onConflictDoNothing()
      .returning()

    // If this is the first view from this device, increment episode view count
    if (result.length > 0) {
      await db
        .update(episodes)
        .set({
          viewCount: sql`${episodes.viewCount} + 1`,
        })
        .where(eq(episodes.id, episodeId))
    }
  } catch (err) {
    console.error('Error recording episode view:', err)
  }
}

// ============ WATCH-TIME TRACKING ============

// Record watch time ping for an episode
export async function recordEpisodeWatchPing(episodeId: number, deviceId: string, minutesWatched: number = 1) {
  try {
    const now = new Date()

    // Check if there's an existing ping for this episode+device
    const existing = await db
      .select()
      .from(episodeWatchPings)
      .where(
        and(
          eq(episodeWatchPings.episodeId, episodeId),
          eq(episodeWatchPings.deviceId, deviceId)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      // Update last ping time and accumulated minutes
      const lastPing = existing[0]
      const timeSinceLastPing = (now.getTime() - new Date(lastPing.lastPingAt!).getTime()) / 1000

      // Only accept if at least 50 seconds have passed (allowing some tolerance for network delay)
      if (timeSinceLastPing < 50) {
        return { accepted: false, reason: 'ping_too_soon' }
      }

      await db
        .update(episodeWatchPings)
        .set({
          minutesWatched: sql`${episodeWatchPings.minutesWatched} + ${minutesWatched}`,
          lastPingAt: now,
        })
        .where(
          and(
            eq(episodeWatchPings.episodeId, episodeId),
            eq(episodeWatchPings.deviceId, deviceId)
          )
        )
    } else {
      // Create new ping record
      await db
        .insert(episodeWatchPings)
        .values({
          episodeId,
          deviceId,
          minutesWatched,
          lastPingAt: now,
        })
        .onConflictDoNothing()
    }

    // Increment total_watch_minutes on the episode
    await db
      .update(episodes)
      .set({
        totalWatchMinutes: sql`${episodes.totalWatchMinutes} + ${minutesWatched}`,
      })
      .where(eq(episodes.id, episodeId))

    return { accepted: true }
  } catch (err) {
    console.error('Error recording watch ping:', err)
    return { accepted: false, reason: 'error' }
  }
}
