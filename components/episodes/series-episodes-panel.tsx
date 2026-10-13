'use client'

import { useState, useMemo, useEffect, type FormEvent } from 'react'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { EpisodeGridCard } from '@/components/episodes/episode-grid-card'
import { ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronLeft, ChevronRight } from 'lucide-react'
import type { Episode } from '@/lib/db/schema'

type SerializedEpisode = Omit<Episode, 'publishedAt'> & { publishedAt: string | null }

interface SeriesEpisodesPanelProps {
  episodes: SerializedEpisode[]
  seriesSlug: string
  synopsis?: string | null
}

type SortOrder = 'newest' | 'oldest'
type Layout = 'grid' | 'list'

const PAGE_SIZE = 24

export function SeriesEpisodesPanel({ episodes, seriesSlug }: SeriesEpisodesPanelProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [layout, setLayout] = useState<Layout>('grid')
  const [page, setPage] = useState(0)
  const [jump, setJump] = useState('')
  const [jumpMsg, setJumpMsg] = useState<string | null>(null)
  const [highlightId, setHighlightId] = useState<number | null>(null)

  const sorted = useMemo(() => {
    const copy = [...episodes]
    copy.sort((a, b) =>
      sortOrder === 'newest' ? b.episodeNumber - a.episodeNumber : a.episodeNumber - b.episodeNumber,
    )
    return copy
  }, [episodes, sortOrder])

  const numbers = useMemo(() => episodes.map((e) => e.episodeNumber), [episodes])
  const minNum = numbers.length ? Math.min(...numbers) : 0
  const maxNum = numbers.length ? Math.max(...numbers) : 0

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE))
  const safePage = Math.min(page, pageCount - 1)
  const current = sorted.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE)

  const rangeLabel = (i: number) => {
    const chunk = sorted.slice(i * PAGE_SIZE, (i + 1) * PAGE_SIZE)
    if (!chunk.length) return ''
    const first = chunk[0].episodeNumber
    const last = chunk[chunk.length - 1].episodeNumber
    return first === last ? `Episode ${first}` : `Episodes ${first} – ${last}`
  }

  const goPage = (p: number) => {
    setPage(Math.max(0, Math.min(pageCount - 1, p)))
    document.getElementById('episodes')?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleJump = (e: FormEvent) => {
    e.preventDefault()
    const n = parseInt(jump, 10)
    if (Number.isNaN(n)) return
    const idx = sorted.findIndex((ep) => ep.episodeNumber === n)
    if (idx >= 0) {
      setJumpMsg(null)
      setPage(Math.floor(idx / PAGE_SIZE))
      setHighlightId(sorted[idx].id)
      return
    }
    const nearest = numbers.reduce((best, x) => (Math.abs(x - n) < Math.abs(best - n) ? x : best), numbers[0])
    setJumpMsg(`Episode ${n} isn't available. Closest is episode ${nearest}.`)
  }

  useEffect(() => {
    if (highlightId === null) return
    const raf = requestAnimationFrame(() => {
      const el = Array.from(document.querySelectorAll(`[data-ep="${highlightId}"]`)).find(
        (node) => (node as HTMLElement).offsetParent !== null,
      )
      el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    })
    const t = setTimeout(() => setHighlightId(null), 3000)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
    }
  }, [highlightId])

  const wrap = (episode: SerializedEpisode, child: React.ReactNode) => (
    <div
      key={episode.id}
      data-ep={episode.id}
      className={highlightId === episode.id ? 'rounded-lg ring-2 ring-primary transition' : ''}
    >
      {child}
    </div>
  )

  const pager =
    pageCount > 1 ? (
      <div className="flex items-center justify-center gap-2">
        <button
          onClick={() => goPage(safePage - 1)}
          disabled={safePage === 0}
          aria-label="Previous page"
          className="rounded-md border border-border bg-card p-2 text-foreground/80 hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <select
          value={safePage}
          onChange={(e) => goPage(Number(e.target.value))}
          aria-label="Episode range"
          className="max-w-[60vw] rounded-md border border-border bg-card px-3 py-2 text-xs font-medium text-foreground"
        >
          {Array.from({ length: pageCount }, (_, i) => (
            <option key={i} value={i}>
              {rangeLabel(i)}
            </option>
          ))}
        </select>
        <button
          onClick={() => goPage(safePage + 1)}
          disabled={safePage === pageCount - 1}
          aria-label="Next page"
          className="rounded-md border border-border bg-card p-2 text-foreground/80 hover:border-primary hover:text-primary disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    ) : null

  return (
    <div>
      <div id="episodes" className="mb-4 flex scroll-mt-24 items-center gap-2 border-b border-border pb-2">
        <span className="h-5 w-1 rounded-full bg-primary" />
        <h2 className="text-base font-bold text-foreground">Episodes ({episodes.length})</h2>
        {episodes.length > 0 && (
          <span className="text-xs text-foreground/60">
            {minNum === maxNum ? `#${minNum}` : `#${minNum} – #${maxNum}`}
          </span>
        )}
      </div>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => {
            setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))
            setPage(0)
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
        >
          {sortOrder === 'newest' ? (
            <ArrowDownWideNarrow className="h-3.5 w-3.5" />
          ) : (
            <ArrowUpWideNarrow className="h-3.5 w-3.5" />
          )}
          {sortOrder === 'newest' ? 'Newest first' : 'Oldest first'}
        </button>

        <div className="flex items-center gap-2">
          {episodes.length > PAGE_SIZE && (
            <form onSubmit={handleJump} className="flex items-center gap-1.5">
              <input
                value={jump}
                onChange={(e) => setJump(e.target.value)}
                inputMode="numeric"
                placeholder="Go to ep #"
                aria-label="Jump to episode number"
                className="w-24 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs text-foreground placeholder:text-foreground/40"
              />
              <button
                type="submit"
                className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
              >
                Go
              </button>
            </form>
          )}
          <button
            onClick={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
            className="hidden rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary sm:inline-flex"
          >
            {layout === 'grid' ? 'List' : 'Grid'} View
          </button>
        </div>
      </div>

      {jumpMsg && <p className="mb-4 text-xs text-amber-500">{jumpMsg}</p>}

      {pager && <div className="mb-4">{pager}</div>}

      {current.length > 0 ? (
        <>
          {layout === 'grid' ? (
            <>
              <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-3">
                {current.map((ep) => wrap(ep, <EpisodeGridCard episode={ep} seriesSlug={seriesSlug} />))}
              </div>
              <div className="space-y-2 sm:hidden">
                {current.map((ep) => wrap(ep, <EpisodeRow episode={ep} seriesSlug={seriesSlug} />))}
              </div>
            </>
          ) : (
            <div className="space-y-2">
              {current.map((ep) => wrap(ep, <EpisodeRow episode={ep} seriesSlug={seriesSlug} />))}
            </div>
          )}

          {pager && <div className="mt-8">{pager}</div>}
        </>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card/40 p-8 text-center">
          <p className="text-foreground/70">No episodes have been published yet.</p>
        </div>
      )}
    </div>
  )
}
