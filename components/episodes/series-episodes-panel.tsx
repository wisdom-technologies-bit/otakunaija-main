'use client'

import { useState, useMemo } from 'react'
import { EpisodeRow } from '@/components/episodes/episode-row'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react'
import type { Episode } from '@/lib/db/schema'

interface SeriesEpisodesPanelProps {
  episodes: Episode[]
  seriesSlug: string
  synopsis?: string | null
}

type Tab = 'episodes' | 'about'
type SortOrder = 'newest' | 'oldest'

export function SeriesEpisodesPanel({ episodes, seriesSlug, synopsis }: SeriesEpisodesPanelProps) {
  const [tab, setTab] = useState<Tab>('episodes')
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest')

  const sortedEpisodes = useMemo(() => {
    const copy = [...episodes]
    copy.sort((a, b) =>
      sortOrder === 'newest'
        ? b.episodeNumber - a.episodeNumber
        : a.episodeNumber - b.episodeNumber
    )
    return copy
  }, [episodes, sortOrder])

  return (
    <div>
      {/* Tabs */}
      <div className="mb-6 flex items-center gap-6 border-b border-border">
        <button
          onClick={() => setTab('episodes')}
          className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
            tab === 'episodes' ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground'
          }`}
        >
          Episodes ({episodes.length})
        </button>
        {synopsis && (
          <button
            onClick={() => setTab('about')}
            className={`border-b-2 pb-2 text-sm font-semibold transition-colors ${
              tab === 'about' ? 'border-primary text-primary' : 'border-transparent text-foreground/60 hover:text-foreground'
            }`}
          >
            About
          </button>
        )}
      </div>

      {tab === 'episodes' && (
        <>
          <div className="mb-4 flex items-center justify-end">
            <button
              onClick={() => setSortOrder((s) => (s === 'newest' ? 'oldest' : 'newest'))}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
            >
              {sortOrder === 'newest' ? (
                <ArrowDownWideNarrow className="h-3.5 w-3.5" />
              ) : (
                <ArrowUpWideNarrow className="h-3.5 w-3.5" />
              )}
              {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
            </button>
          </div>

          {sortedEpisodes.length > 0 ? (
            <div className="space-y-3">
              {sortedEpisodes.map((episode) => (
                <EpisodeRow key={episode.id} episode={episode} seriesSlug={seriesSlug} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-border/40 bg-card/40 p-8 text-center">
              <p className="text-foreground/70">No episodes have been published yet.</p>
            </div>
          )}
        </>
      )}

      {tab === 'about' && synopsis && (
        <div className="prose-anime prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{synopsis}</ReactMarkdown>
        </div>
      )}
    </div>
  )
}