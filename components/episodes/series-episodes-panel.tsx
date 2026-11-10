'use client'

import { useEffect, useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, Check, ChevronLeft, ChevronRight, Play } from 'lucide-react'
import type { Episode } from '@/lib/db/schema'
import { formatReleaseDate } from '@/lib/format-date'
import { formatDuration } from '@/lib/episode-utils'
import {
  episodeRanges,
  highestEpisodeNumber,
  isNewEpisode,
  rangeIndexForEpisode,
} from '@/lib/episode-ui'
import { getHistory } from '@/lib/watch-history'

type SerializedEpisode = Omit<Episode, 'publishedAt'> & { publishedAt: string | null }

interface SeriesEpisodesPanelProps {
  episodes: SerializedEpisode[]
  seriesSlug: string
  synopsis?: string | null
}

type SortOrder = 'newest' | 'oldest'

/**
 * The series' episode list: a grid of 16:9 cards from 640px and a compact list
 * on phones, with a range selector once a series runs past 50 episodes.
 *
 * The "New" chip belongs to the newest episode only, and only for 72 hours.
 * Watched state comes from the same local history the player writes.
 */
export function SeriesEpisodesPanel({ episodes, seriesSlug }: SeriesEpisodesPanelProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [rangeIndex, setRangeIndex] = useState<number | null>(null)
  const [jump, setJump] = useState('')
  const [jumpMsg, setJumpMsg] = useState<string | null>(null)
  const [watched, setWatched] = useState<Set<string>>(() => new Set())
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    setWatched(new Set(getHistory().map((entry) => entry.episodeSlug)))
  }, [])

  const sorted = useMemo(() => {
    const copy = [...episodes]
    copy.sort((a, b) =>
      sortOrder === 'newest' ? b.episodeNumber - a.episodeNumber : a.episodeNumber - b.episodeNumber,
    )
    return copy
  }, [episodes, sortOrder])

  const maxNumber = highestEpisodeNumber(episodes)
  const ranges = useMemo(() => episodeRanges(maxNumber), [maxNumber])
  const newestNumber = useMemo(
    () =>
      episodes.reduce((best, ep) => {
        const published = ep.publishedAt ? new Date(ep.publishedAt).getTime() : Number.NaN
        if (Number.isNaN(published)) return best
        return published > best.time ? { time: published, number: ep.episodeNumber } : best
      }, { time: Number.NEGATIVE_INFINITY, number: 0 }),
    [episodes],
  )

  const activeRange = rangeIndex === null ? null : ranges[rangeIndex] ?? null
  const visible = activeRange
    ? sorted.filter((ep) => ep.episodeNumber >= activeRange.start && ep.episodeNumber <= activeRange.end)
    : sorted

  const newNumber =
    now !== null && newestNumber.number > 0 && isNewEpisode(newestNumber.time, now)
      ? newestNumber.number
      : null

  const handleJump = (event: FormEvent) => {
    event.preventDefault()
    const target = parseInt(jump, 10)
    if (Number.isNaN(target)) return
    const exists = episodes.some((ep) => ep.episodeNumber === target)
    if (!exists) {
      setJumpMsg(`Episode ${target} isn't available yet.`)
      return
    }
    setJumpMsg(null)
    setRangeIndex(rangeIndexForEpisode(target))
    setJump('')
    // Scroll to the row once the range has rendered.
    window.setTimeout(() => {
      document
        .querySelector(`[data-episode-number="${target}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  const jumpToLatest = () => {
    const latest = episodes.reduce((best, ep) => (ep.episodeNumber > best ? ep.episodeNumber : best), 0)
    if (!latest) return
    setRangeIndex(rangeIndexForEpisode(latest))
    window.setTimeout(() => {
      document
        .querySelector(`[data-episode-number="${latest}"]`)
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }, 60)
  }

  if (episodes.length === 0) {
    return (
      <div className="otk-empty" data-testid="episodes-empty">
        <p className="text-sm font-semibold text-[var(--otk-text)]">No episodes yet</p>
        <p className="text-sm text-[var(--otk-text-dim)]">
          Episodes appear here as soon as the first one airs.
        </p>
      </div>
    )
  }

  return (
    <section id="episodes" aria-labelledby="series-episodes-heading" className="scroll-mt-24">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <h2 id="series-episodes-heading" className="otk-section-title text-[1.25rem] sm:text-[1.4rem]">
            Episodes
          </h2>
          <p className="otk-meta mt-1">
            <span>{episodes.length} available</span>
            {maxNumber ? <span>· up to E{maxNumber}</span> : null}
            {activeRange ? <span>· showing {activeRange.label}</span> : null}
          </p>
        </div>

        <div className="otk-ep-panel-tools">
          <button
            type="button"
            onClick={() => setSortOrder((order) => (order === 'newest' ? 'oldest' : 'newest'))}
            className="otk-btn otk-btn-quiet otk-focus !min-h-9 !px-3 !text-xs"
            data-testid="episode-sort-toggle"
          >
            {sortOrder === 'newest' ? (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpWideNarrow className="h-3.5 w-3.5" />
            )}
            {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
          </button>

          <form onSubmit={handleJump} className="flex items-center gap-1.5">
            <label htmlFor="episode-jump" className="sr-only">
              Jump to episode number
            </label>
            <input
              id="episode-jump"
              value={jump}
              onChange={(event) => setJump(event.target.value)}
              inputMode="numeric"
              placeholder="Ep #"
              className="h-9 w-16 rounded-full border border-[var(--otk-border)] bg-[var(--otk-surface)] px-3 text-xs text-[var(--otk-text)] placeholder:text-[var(--otk-text-dim)]"
            />
            <button type="submit" className="otk-btn otk-btn-quiet otk-focus !min-h-9 !px-3 !text-xs">
              Go
            </button>
          </form>
        </div>
      </div>

      {jumpMsg ? (
        <p className="mb-3 text-xs font-medium text-amber-400" role="status">
          {jumpMsg}
        </p>
      ) : null}

      {ranges.length > 1 ? (
        <div className="otk-range-tabs mb-4" role="group" aria-label="Episode ranges">
          <button
            type="button"
            onClick={() => setRangeIndex(null)}
            aria-pressed={rangeIndex === null}
            data-active={rangeIndex === null}
            className="otk-pill otk-focus !min-h-9 !text-xs"
          >
            All
          </button>
          {ranges.map((range) => (
            <button
              key={range.index}
              type="button"
              onClick={() => setRangeIndex(range.index)}
              aria-pressed={rangeIndex === range.index}
              data-active={rangeIndex === range.index}
              data-testid={`episode-range-${range.index}`}
              className="otk-pill otk-focus !min-h-9 !text-xs"
            >
              {range.label}
            </button>
          ))}
        </div>
      ) : null}

      <ol className="otk-ep-list" data-testid="episode-list">
        {visible.map((episode) => {
          const published = episode.publishedAt ? formatReleaseDate(episode.publishedAt) : ''
          const duration = episode.durationSeconds ? formatDuration(episode.durationSeconds) : ''
          const isWatched = watched.has(episode.slug)
          const isNew = newNumber === episode.episodeNumber
          return (
            <li key={episode.id} className="min-w-0">
              <Link
                href={`/episodes/${seriesSlug}/${episode.slug}`}
                className="otk-ep-item otk-focus"
                data-episode-number={episode.episodeNumber}
              >
                <div className="otk-ep-thumb otk-media otk-media-16x9">
                  {episode.thumbnailUrl ? (
                    <img
                      src={episode.thumbnailUrl}
                      alt={`Episode ${episode.episodeNumber} thumbnail`}
                      loading="lazy"
                      decoding="async"
                      width={320}
                      height={180}
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center text-[10px] text-[var(--otk-text-dim)]">
                      No image
                    </span>
                  )}
                  <span className="otk-ep-play" aria-hidden="true">
                    <Play />
                  </span>
                  {isNew ? (
                    <span className="otk-chip otk-chip-new absolute left-1.5 top-1.5 z-[3]">New</span>
                  ) : null}
                  {duration ? (
                    <span className="otk-chip absolute bottom-1.5 right-1.5 z-[3] !bg-black/70 !text-white">
                      {duration}
                    </span>
                  ) : null}
                </div>

                <div className="otk-ep-body">
                  <span className="otk-ep-number">Episode {episode.episodeNumber}</span>
                  <span className="otk-ep-title">{episode.title}</span>
                  <span className="otk-ep-meta">
                    {published ? <span>{published}</span> : null}
                    {published && duration ? <span aria-hidden="true">·</span> : null}
                    {duration ? <span>{duration}</span> : null}
                    {isWatched ? (
                      <span className="otk-ep-watched" data-testid="episode-watched">
                        <Check className="h-3 w-3" /> Watched
                      </span>
                    ) : null}
                  </span>
                </div>
              </Link>
            </li>
          )
        })}
      </ol>

      {visible.length === 0 ? (
        <p className="py-6 text-center text-sm text-[var(--otk-text-dim)]">Nothing in this range yet.</p>
      ) : null}

      {episodes.length > 6 ? (
        <div className="otk-jump-latest">
          <button
            type="button"
            onClick={jumpToLatest}
            className="otk-btn otk-btn-quiet otk-focus !min-h-9 !text-xs"
            data-testid="jump-to-latest"
          >
            <ChevronRight className="h-3.5 w-3.5" /> Jump to latest
          </button>
        </div>
      ) : null}

      {ranges.length > 1 ? (
        <div className="mt-5 flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setRangeIndex(Math.max(0, (rangeIndex ?? 0) - 1))}
            disabled={(rangeIndex ?? 0) === 0}
            aria-label="Previous episode range"
            className="otk-btn otk-btn-quiet otk-focus !min-h-9 !px-3 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-xs text-[var(--otk-text-dim)]">
            {activeRange ? activeRange.label : `1 – ${maxNumber}`}
          </span>
          <button
            type="button"
            onClick={() => setRangeIndex(Math.min(ranges.length - 1, (rangeIndex ?? 0) + 1))}
            disabled={(rangeIndex ?? 0) >= ranges.length - 1}
            aria-label="Next episode range"
            className="otk-btn otk-btn-quiet otk-focus !min-h-9 !px-3 disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </section>
  )
}

export default SeriesEpisodesPanel
