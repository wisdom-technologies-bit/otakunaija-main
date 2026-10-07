'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { clearHistory, getHistory, removeEntry, type HistoryEntry } from '@/lib/watch-history'
import { SectionTitle } from '@/components/episodes/section-title'

function formatTime(seconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(seconds))
  const hours = Math.floor(safeSeconds / 3600)
  const minutes = Math.floor((safeSeconds % 3600) / 60)
  const remainingSeconds = safeSeconds % 60

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`
  }

  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`
}

function progressPercent(entry: HistoryEntry): number {
  if (entry.durationSeconds <= 0 || entry.positionSeconds <= 0) return 0
  return Math.min(100, Math.max(0, (entry.positionSeconds / entry.durationSeconds) * 100))
}

export function ResumeWatchingRow() {
  const [mounted, setMounted] = useState(false)
  const [history, setHistory] = useState<HistoryEntry[]>([])

  useEffect(() => {
    const refresh = () => setHistory(getHistory())
    refresh()
    setMounted(true)

    window.addEventListener('otn-history-changed', refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener('otn-history-changed', refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  if (!mounted || history.length === 0) return null

  return (
    <section aria-labelledby="resume-watching-title">
      <SectionTitle
        title="Resume Watching"
        action={<button type="button" onClick={clearHistory} className="text-xs text-muted-foreground transition-colors hover:text-foreground">Clear All</button>}
      />

      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2 no-scrollbar">
        {history.map((entry) => {
          const progress = progressPercent(entry)
          return (
            <Link
              key={entry.episodeSlug}
              href={`/episodes/${entry.seriesSlug}/${entry.episodeSlug}`}
              className="group w-[168px] shrink-0 snap-start"
            >
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                {entry.thumb ? (
                  <Image
                    src={entry.thumb}
                    alt={`${entry.seriesTitle} episode ${entry.epNumber}`}
                    fill
                    sizes="168px"
                    className="object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="h-full w-full bg-gradient-to-br from-primary/20 to-primary/5" />
                )}
                <span className="absolute bottom-2 left-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  EP {entry.epNumber}
                </span>
                {progress > 0 && (
                  <span
                    aria-hidden="true"
                    className="absolute bottom-0 left-0 h-[3px] bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                )}
                <button
                  type="button"
                  aria-label="Remove from history"
                  onClick={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    removeEntry(entry.episodeSlug)
                  }}
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-xs text-white transition-colors hover:bg-black"
                >
                  <span aria-hidden="true">✕</span>
                </button>
              </div>
              <p className="mt-2 truncate text-xs font-medium text-foreground">{entry.seriesTitle}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {entry.positionSeconds > 10 ? `Resume at ${formatTime(entry.positionSeconds)}` : 'Start watching'}
              </p>
            </Link>
          )
        })}
      </div>
    </section>
  )
}

export default ResumeWatchingRow

// The scrollbar utility is available in the site's Tailwind setup; this fallback keeps the row usable without it.
