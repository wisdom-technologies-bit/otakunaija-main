'use client'

import { useEffect, useState } from 'react'
import { CalendarClock } from 'lucide-react'
import { NewsletterSignup } from '@/components/newsletter-signup'
import { TrailerModal } from '@/components/episodes/trailer-modal'
import { ShareButton } from '@/components/episodes/share-button'
import {
  countdownParts,
  countdownTiles,
  formatCountdown,
  type CountdownParts,
} from '@/lib/episode-ui'

type SeriesUpcomingPanelProps = {
  seriesSlug: string
  seriesTitle: string
  /** "Coming Mar 12, 2027" / "Coming TBA". */
  comingLabel: string
  /** "Mar 12, 2027" / "Mar 2027" / "2027" / "TBA". */
  startLabel: string
  /** Full ISO date when only the day is known; drives the live countdown. */
  startDate?: string | null
  format?: string | null
  episodesTotal?: number | null
  trailerSite?: string | null
  trailerId?: string | null
  shareUrl: string
}

/**
 * What a not-yet-released series shows instead of a play button and an empty
 * episode list: when it lands, how long that is, the trailer and a way to be
 * told about it.
 *
 * The countdown is client-only so the server HTML stays cacheable, and it is
 * recalculated once a second from the same pure helpers the tests cover.
 */
export function SeriesUpcomingPanel({
  seriesSlug,
  seriesTitle,
  comingLabel,
  startLabel,
  startDate,
  format,
  episodesTotal,
  trailerSite,
  trailerId,
  shareUrl,
}: SeriesUpcomingPanelProps) {
  const [parts, setParts] = useState<CountdownParts | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    if (!startDate) return
    const update = () => setParts(countdownParts(startDate))
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [startDate])

  const tiles = countdownTiles(parts)

  return (
    <section
      id="notify"
      className="otk-upcoming scroll-mt-24"
      aria-labelledby="series-upcoming-heading"
      data-testid="series-upcoming-panel"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="otk-eyebrow">Not out yet</p>
          <h2 id="series-upcoming-heading" className="otk-upcoming-headline mt-1">
            {comingLabel}
          </h2>
          <p className="mt-2 max-w-xl text-sm text-[var(--otk-text-dim)]">
            {seriesTitle} has been announced. Episodes appear here as soon as the first one airs.
          </p>
        </div>
        <span className="otk-chip">
          <CalendarClock className="h-3 w-3" /> {startLabel}
        </span>
      </div>

      {startDate ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--otk-text-dim)]">
            {mounted ? (
              <span data-testid="upcoming-countdown-label">{formatCountdown(parts)}</span>
            ) : (
              <span aria-hidden="true">·</span>
            )}
          </p>
          {tiles.length > 0 ? (
            <div className="otk-countdown" data-testid="upcoming-countdown">
              {tiles.map((tile) => (
                <span key={tile.label} className="otk-countdown-tile">
                  <span className="otk-countdown-value">{tile.value}</span>
                  <span className="otk-countdown-label">{tile.label}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <p className="text-sm font-semibold text-[var(--otk-text)]" data-testid="upcoming-tba">
          Release date TBA
        </p>
      )}

      <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-xs uppercase tracking-wide text-[var(--otk-text-dim)]">Release</dt>
          <dd className="font-semibold text-[var(--otk-text)]">{startLabel}</dd>
        </div>
        {format ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--otk-text-dim)]">Format</dt>
            <dd className="font-semibold text-[var(--otk-text)]">{format}</dd>
          </div>
        ) : null}
        {episodesTotal ? (
          <div>
            <dt className="text-xs uppercase tracking-wide text-[var(--otk-text-dim)]">Episodes announced</dt>
            <dd className="font-semibold text-[var(--otk-text)]">{episodesTotal}</dd>
          </div>
        ) : null}
      </dl>

      <div className="otk-hero-actions">
        <TrailerModal site={trailerSite} id={trailerId} title={seriesTitle} className="!text-[var(--otk-text)] !border-[var(--otk-border)] !bg-[var(--otk-surface-2)]" />
        <ShareButton url={shareUrl} title={seriesTitle} />
      </div>

      <div className="rounded-[var(--otk-radius)] border border-[var(--otk-border)] bg-[var(--otk-surface-2)] p-4">
        <h3 className="text-sm font-bold text-[var(--otk-text)]">Get notified when it starts</h3>
        <p className="mt-1 mb-3 text-sm text-[var(--otk-text-dim)]">
          One email when {seriesTitle} lands. No spam.
        </p>
        <NewsletterSignup />
      </div>

      <p className="sr-only">{seriesSlug}</p>
    </section>
  )
}

export default SeriesUpcomingPanel
