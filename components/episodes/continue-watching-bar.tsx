'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Play } from 'lucide-react'
import { HISTORY_CHANGED_EVENT, getHistory, type HistoryEntry } from '@/lib/watch-history'

/**
 * "Continue watching" for one series. Reads the local watch history the player
 * already writes (lib/watch-history) after mount, so the server render never
 * touches localStorage and there is no hydration mismatch. Renders nothing when
 * the viewer has no progress in this series.
 */
export function ContinueWatchingBar({ seriesSlug }: { seriesSlug: string }) {
  const [entry, setEntry] = useState<HistoryEntry | null>(null)

  useEffect(() => {
    const read = () =>
      setEntry(getHistory().find((item) => item.seriesSlug === seriesSlug) ?? null)
    read()
    window.addEventListener(HISTORY_CHANGED_EVENT, read)
    window.addEventListener('storage', read)
    return () => {
      window.removeEventListener(HISTORY_CHANGED_EVENT, read)
      window.removeEventListener('storage', read)
    }
  }, [seriesSlug])

  if (!entry) return null

  const percent =
    entry.durationSeconds > 0
      ? Math.min(100, Math.max(0, Math.round((entry.positionSeconds / entry.durationSeconds) * 100)))
      : null

  return (
    <div className="otk-continue" data-testid="continue-watching-bar">
      <span className="otk-continue-label">Continue watching</span>
      <span className="min-w-0 flex-1 text-sm font-semibold text-[var(--otk-text)]">
        <span className="block truncate">
          Episode {entry.epNumber}
          {entry.seriesTitle ? <span className="sr-only"> of {entry.seriesTitle}</span> : null}
        </span>
      </span>
      {percent !== null ? (
        <span
          className="otk-progress-track"
          role="progressbar"
          aria-label="Watch progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
        >
          <span className="otk-progress-fill" style={{ width: `${percent}%` }} />
        </span>
      ) : null}
      <Link
        href={`/episodes/${seriesSlug}/${entry.episodeSlug}`}
        className="otk-btn otk-btn-primary otk-focus"
      >
        <Play className="h-4 w-4 fill-current" />
        Resume{percent !== null ? ` ${percent}%` : ''}
      </Link>
    </div>
  )
}

export default ContinueWatchingBar
