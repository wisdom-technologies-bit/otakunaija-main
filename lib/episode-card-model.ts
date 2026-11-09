import { formatDuration } from "./episode-utils"

/** Episodes stay "New" for a day after release. */
export const NEW_EPISODE_WINDOW_HOURS = 24

export type EpisodeCardEpisodeInput = {
  slug: string
  title: string
  episodeNumber: number
  thumbnailUrl?: string | null
  durationSeconds?: number | null
  publishedAt?: string | Date | null
}

export type EpisodeCardSeriesInput = { slug: string; title: string } | null | undefined

export function episodeHref(seriesSlug: string, episodeSlug: string): string {
  return `/episodes/${seriesSlug}/${episodeSlug}`
}

export function isNewEpisode(
  publishedAt: string | Date | null | undefined,
  now: number = Date.now(),
  windowHours: number = NEW_EPISODE_WINDOW_HOURS,
): boolean {
  if (!publishedAt) return false
  const time = publishedAt instanceof Date ? publishedAt.getTime() : new Date(publishedAt).getTime()
  if (Number.isNaN(time)) return false
  const age = now - time
  return age >= 0 && age < windowHours * 60 * 60 * 1000
}

export type EpisodeCardModel = {
  href: string
  epLabel: string
  seriesTitle: string
  isNew: boolean
  durationLabel: string | null
  publishedAtISO: string | null
  hasThumbnail: boolean
}

export function episodeCardModel(
  episode: EpisodeCardEpisodeInput,
  series: EpisodeCardSeriesInput,
  now: number = Date.now(),
): EpisodeCardModel {
  const published = episode.publishedAt ?? null
  const publishedAtISO = published ? new Date(published).toISOString() : null
  return {
    href: episodeHref(series?.slug ?? "", episode.slug),
    epLabel: `Ep ${episode.episodeNumber}`,
    seriesTitle: series?.title ?? episode.title,
    isNew: isNewEpisode(published, now),
    durationLabel:
      typeof episode.durationSeconds === "number" && episode.durationSeconds > 0
        ? formatDuration(episode.durationSeconds)
        : null,
    publishedAtISO: publishedAtISO && publishedAtISO !== "Invalid Date" ? publishedAtISO : null,
    hasThumbnail: Boolean(episode.thumbnailUrl?.trim()),
  }
}
