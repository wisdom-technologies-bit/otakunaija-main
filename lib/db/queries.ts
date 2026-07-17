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
