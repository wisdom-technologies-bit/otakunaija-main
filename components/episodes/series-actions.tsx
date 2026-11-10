'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play, Sparkles } from 'lucide-react'
import { getHistory } from '@/lib/watch-history'
import { ShareButton } from '@/components/episodes/share-button'
import { TrailerModal } from '@/components/episodes/trailer-modal'

type EpisodeRef = { slug: string; episodeNumber: number; title: string }

type SeriesActionsProps = {
  seriesSlug: string
  seriesTitle: string
  firstEpisode?: EpisodeRef | null
  latestEpisode?: EpisodeRef | null
  trailerSite?: string | null
  trailerId?: string | null
  upcoming?: boolean
  /** Root-relative canonical path used for sharing. */
  shareUrl: string
}

/**
 * The series action row: Play (or Continue, from the local watch history),
 * Latest episode, Trailer and Share. An upcoming series has nothing to play, so
 * the play button becomes the notify anchor instead of lying about a video.
 */
export function SeriesActions({
  seriesSlug,
  seriesTitle,
  firstEpisode,
  latestEpisode,
  trailerSite,
  trailerId,
  upcoming = false,
  shareUrl,
}: SeriesActionsProps) {
  const [resume, setResume] = useState<{ slug: string; episodeNumber: number } | null>(null)

  useEffect(() => {
    if (upcoming) return
    const entry = getHistory().find((item) => item.seriesSlug === seriesSlug)
    if (entry) setResume({ slug: entry.episodeSlug, episodeNumber: entry.epNumber })
  }, [seriesSlug, upcoming])

  const playTarget = resume
    ? { href: `/episodes/${seriesSlug}/${resume.slug}`, label: `Continue E${resume.episodeNumber}` }
    : firstEpisode
      ? { href: `/episodes/${seriesSlug}/${firstEpisode.slug}`, label: 'Play' }
      : null

  const latestTarget =
    latestEpisode && (!firstEpisode || latestEpisode.slug !== firstEpisode.slug)
      ? { href: `/episodes/${seriesSlug}/${latestEpisode.slug}`, label: `Latest · E${latestEpisode.episodeNumber}` }
      : null

  return (
    <div className="otk-hero-actions" data-testid="series-actions">
      {upcoming ? (
        <a href="#notify" className="otk-btn otk-btn-primary otk-focus" data-testid="series-notify-action">
          <Sparkles className="h-4 w-4" />
          Get notified
        </a>
      ) : playTarget ? (
        <Link
          href={playTarget.href}
          className="otk-btn otk-btn-primary otk-focus"
          data-testid="series-play-action"
        >
          <Play className="h-4 w-4 fill-current" />
          {playTarget.label}
        </Link>
      ) : null}

      {latestTarget ? (
        <Link
          href={latestTarget.href}
          className="otk-btn otk-btn-quiet otk-focus"
          data-testid="series-latest-action"
        >
          {latestTarget.label}
        </Link>
      ) : null}

      <TrailerModal site={trailerSite} id={trailerId} title={seriesTitle} />
      <ShareButton url={shareUrl} title={seriesTitle} />
    </div>
  )
}

export default SeriesActions
