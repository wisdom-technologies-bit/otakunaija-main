import Link from 'next/link'
import type { Series } from '@/lib/db/schema'
import { SeriesLogo } from '@/components/episodes/series-logo'
import { SeriesActions } from '@/components/episodes/series-actions'
import { seriesStatusClass, seriesStatusLabel } from '@/lib/series-upcoming'
import { episodeCountLabel } from '@/lib/episode-ui'

type EpisodeRef = { slug: string; episodeNumber: number; title: string }

export type SeriesHeroBandProps = {
  series: Series
  /** Episodes that exist right now. */
  airedCount: number
  /** Announced total, when the schedule knows it. */
  totalEpisodes: number | null
  studio: string | null
  genres: string[]
  /** "Next episode Tue 21:00" when a schedule entry is ahead of us. */
  nextEpisodeLabel: string | null
  durationLabel: string | null
  firstEpisode: EpisodeRef | null
  latestEpisode: EpisodeRef | null
  upcoming: boolean
}

/**
 * The series page hero band. The banner is the background, never a giant poster;
 * the poster is a fixed 2/3 card that only appears from 768px up, so phones get
 * the synopsis and actions above the fold instead of artwork.
 */
export function SeriesHeroBand({
  series,
  airedCount,
  totalEpisodes,
  studio,
  genres,
  nextEpisodeLabel,
  durationLabel,
  firstEpisode,
  latestEpisode,
  upcoming,
}: SeriesHeroBandProps) {
  const year = series.seasonYear ?? series.startYear ?? (series.createdAt ? new Date(series.createdAt).getFullYear() : null)
  const season = series.season ? series.season.replace(/^\w/, (c) => c.toUpperCase()) : null
  const countLabel = upcoming
    ? 'Upcoming'
    : episodeCountLabel(totalEpisodes || airedCount || null, series.status)

  return (
    <header className="otk-series-hero" data-testid="series-hero">
      {series.coverImageUrl ? (
        <img
          src={series.coverImageUrl}
          alt={`${series.title} banner`}
          className="otk-series-hero-media"
          fetchPriority="high"
          decoding="sync"
          width={1600}
          height={900}
        />
      ) : (
        <div className="otk-series-hero-media otk-cover-fallback otk-fallback-default" aria-hidden="true" />
      )}
      <div className="otk-series-hero-scrim" />

      <div className="otk-series-hero-inner">
        {series.posterImageUrl ? (
          <div className="otk-series-poster otk-media otk-media-2x3" data-testid="series-poster">
            <img
              src={series.posterImageUrl}
              alt={`${series.title} poster`}
              loading="lazy"
              decoding="async"
              width={232}
              height={348}
            />
          </div>
        ) : null}

        <div className="min-w-0 flex-1 space-y-2.5 md:space-y-3">
          <SeriesLogo
            title={series.title}
            logoPath={series.logoPath}
            aspect={series.logoAspectRatio}
            width={series.logoWidth}
            maxHeight="clamp(40px, 9vw, 96px)"
            priority
            as="h1"
            textClassName="otk-series-title"
            logoClassName="otk-series-logo"
          />

          <div className="otk-series-chips">
            <span className={`otk-chip ${seriesStatusClass(series.status)}`} data-testid="series-status-chip">
              {seriesStatusLabel(series.status)}
            </span>
            {series.format ? <span className="otk-chip">{series.format}</span> : null}
            {season ? (
              <span className="otk-chip">
                {season}
                {year ? ` ${year}` : ''}
              </span>
            ) : year ? (
              <span className="otk-chip">{year}</span>
            ) : null}
            {studio ? <span className="otk-chip max-w-[12rem]">{studio}</span> : null}
          </div>

          {genres.length > 0 ? (
            <div className="otk-chip-scroller" role="group" aria-label="Genres">
              {genres.slice(0, 6).map((genre) => (
                <Link
                  key={genre}
                  href={`/episodes/browse?genre=${encodeURIComponent(genre)}`}
                  className="otk-chip otk-chip-link otk-focus"
                >
                  {genre}
                </Link>
              ))}
            </div>
          ) : null}

          <div className="otk-stats-line">
            <span data-testid="series-episode-stat">
              {upcoming
                ? totalEpisodes
                  ? `${totalEpisodes} episodes announced`
                  : 'Episodes TBA'
                : totalEpisodes && totalEpisodes > airedCount
                  ? `${airedCount} of ${totalEpisodes} episodes`
                  : `${airedCount} episode${airedCount === 1 ? '' : 's'}`}
            </span>
            {durationLabel ? (
              <>
                <span aria-hidden="true">•</span>
                <span>{durationLabel}</span>
              </>
            ) : null}
            {nextEpisodeLabel ? (
              <>
                <span aria-hidden="true">•</span>
                <span data-testid="series-next-episode">{nextEpisodeLabel}</span>
              </>
            ) : null}
            {!upcoming && countLabel === 'Airing' ? (
              <>
                <span aria-hidden="true">•</span>
                <span>Airing</span>
              </>
            ) : null}
          </div>

          <SeriesActions
            seriesSlug={series.slug}
            seriesTitle={series.title}
            firstEpisode={firstEpisode}
            latestEpisode={latestEpisode}
            trailerSite={series.trailerSite}
            trailerId={series.trailerId}
            upcoming={upcoming}
            shareUrl={`/episodes/${series.slug}`}
          />
        </div>
      </div>
    </header>
  )
}

export default SeriesHeroBand
