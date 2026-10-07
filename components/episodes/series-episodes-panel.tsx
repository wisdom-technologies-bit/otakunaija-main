'use client'

import { useState, useMemo } from 'react'
import { EpisodeRow } from '@/components/episodes/episode-row'
import { EpisodeGridCard } from '@/components/episodes/episode-grid-card'
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import type { Episode } from '@/lib/db/schema'

type SerializedEpisode = Omit<Episode, 'publishedAt'> & { publishedAt: string | null }

interface SeriesEpisodesPanelProps {
  episodes: SerializedEpisode[]
  seriesSlug: string
  synopsis?: string | null
}

type SortOrder = 'newest' | 'oldest'
type Layout = 'grid' | 'list'

const ITEMS_PER_PAGE = 12

export function SeriesEpisodesPanel({ episodes, seriesSlug }: SeriesEpisodesPanelProps) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')
  const [layout, setLayout] = useState<Layout>('grid')
  const [displayCount, setDisplayCount] = useState(ITEMS_PER_PAGE)

  const sortedEpisodes = useMemo(() => {
    const copy = [...episodes]
    copy.sort((a, b) =>
      sortOrder === 'newest'
        ? b.episodeNumber - a.episodeNumber
        : a.episodeNumber - b.episodeNumber
    )
    return copy
  }, [episodes, sortOrder])

  const displayedEpisodes = useMemo(() => {
    return sortedEpisodes.slice(0, displayCount)
  }, [sortedEpisodes, displayCount])

  const hasMore = displayCount < sortedEpisodes.length

  return (
    <div>
      <div id="episodes" className="mb-4 flex scroll-mt-24 items-center gap-2 border-b border-border pb-2">
        <span className="h-5 w-1 rounded-full bg-primary" />
        <h2 className="text-base font-bold text-foreground">Episodes ({episodes.length})</h2>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs text-foreground/70">Sort by:</span>
          <button
            onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
          >
            {sortOrder === 'newest' ? (
              <ArrowDownWideNarrow className="h-3.5 w-3.5" />
            ) : (
              <ArrowUpWideNarrow className="h-3.5 w-3.5" />
            )}
            {sortOrder === 'newest' ? 'Episode Number' : 'Oldest First'}
          </button>
        </div>
        <button
          onClick={() => setLayout((l) => (l === 'grid' ? 'list' : 'grid'))}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
        >
          {layout === 'grid' ? 'List' : 'Grid'} View
        </button>
      </div>

      {displayedEpisodes.length > 0 ? (
        <>
          {layout === 'grid' ? (
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {displayedEpisodes.map((episode) => (
                <EpisodeGridCard key={episode.id} episode={episode} seriesSlug={seriesSlug} />
              ))}
            </div>
          ) : (
            <div className="space-y-3">
              {displayedEpisodes.map((episode) => (
                <EpisodeRow key={episode.id} episode={episode} seriesSlug={seriesSlug} />
              ))}
            </div>
          )}

          {/* View More / Pagination */}
          {hasMore && (
            <div className="mt-8 flex justify-center">
              <button
                onClick={() => setDisplayCount((c) => c + ITEMS_PER_PAGE)}
                className="rounded-lg border border-primary bg-primary/10 px-6 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 transition-colors"
              >
                View More Episodes
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-lg border border-border/40 bg-card/40 p-8 text-center">
          <p className="text-foreground/70">No episodes have been published yet.</p>
        </div>
      )}
    </div>
  )
}
