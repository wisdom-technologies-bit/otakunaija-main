'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Play } from 'lucide-react'
import { getHistory } from '@/lib/watch-history'

export type UpNextEpisode = {
  id: number
  slug: string
  episodeNumber: number
  title: string
  thumbnailUrl: string | null
  durationSeconds: number | null
}

type UpNextListProps = {
  seriesSlug: string
  episodes: UpNextEpisode[]
  currentEpisodeId: string | number
}

/**
 * "Up next": the next handful of episodes with thumbnails, the current one
 * marked and scrolled into view inside the list itself (never the page).
 *
 * Watched state comes from the same local history the player writes, read after
 * mount so the server HTML and the client agree.
 */
export function UpNextList({ seriesSlug, episodes, currentEpisodeId }: UpNextListProps) {
  const currentRef = useRef<HTMLAnchorElement | null>(null)
  const [watched, setWatched] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    setWatched(new Set(getHistory().map((entry) => entry.episodeSlug)))
  }, [])

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'nearest' })
  }, [])

  if (episodes.length === 0) return null

  return (
    <section className="otk-aside-section" aria-labelledby="up-next-heading" data-testid="up-next-list">
      <h2 id="up-next-heading" className="otk-aside-title">
        Up next
      </h2>
      <ul className="space-y-1">
        {episodes.map((episode) => {
          const isCurrent = String(episode.id) === String(currentEpisodeId)
          return (
            <li key={episode.id} className="min-w-0">
              <Link
                href={`/episodes/${seriesSlug}/${episode.slug}`}
                aria-current={isCurrent ? 'true' : undefined}
                className="otk-upnext-item otk-focus"
                ref={isCurrent ? currentRef : undefined}
              >
                <span className="otk-upnext-thumb otk-media otk-media-16x9">
                  {episode.thumbnailUrl ? (
                    <img
                      src={episode.thumbnailUrl}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      width={176}
                      height={99}
                    />
                  ) : (
                    <span className="absolute inset-0 grid place-items-center">
                      <Play className="h-3 w-3 text-[var(--otk-text-dim)]" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="otk-ep-number block">E{episode.episodeNumber}</span>
                  <span className="otk-upnext-title">{episode.title}</span>
                  {isCurrent ? (
                    <span className="otk-ep-watched mt-0.5">
                      <Play className="h-3 w-3" /> Now playing
                    </span>
                  ) : watched.has(episode.slug) ? (
                    <span className="otk-ep-watched mt-0.5">
                      <Check className="h-3 w-3" /> Watched
                    </span>
                  ) : null}
                </span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

export default UpNextList
