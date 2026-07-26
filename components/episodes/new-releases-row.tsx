import Link from 'next/link'
import Image from 'next/image'
import { formatRelativeTime } from '@/lib/posts'
import type { episodes as Episode, series as Series } from '@/lib/db/schema'

interface NewReleasesRowProps {
  items: { episode: typeof Episode.$inferSelect; series: typeof Series.$inferSelect | null }[]
}

export function NewReleasesRow({ items }: NewReleasesRowProps) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">New Releases</h2>
        <Link href="/episodes/new-releases" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-hide">
        {items.map(({ episode, series: ser }) =>
          ser ? (
            <Link
              key={episode.id}
              href={`/episodes/${ser.slug}/${episode.slug}`}
              className="group w-[75vw] max-w-[280px] sm:w-52 md:w-44 flex-shrink-0 snap-start"
            >
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-muted">
                {episode.thumbnailUrl ? (
                  <Image
                    src={episode.thumbnailUrl}
                    alt={episode.title}
                    fill
                    className="object-cover transition-transform group-hover:scale-105"
                    sizes="(max-width: 640px) 75vw, (max-width: 768px) 208px, 176px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">
                  New
                </span>
                <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Ep {episode.episodeNumber}
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                {ser.title}
              </p>
              <p className="text-xs text-muted-foreground">
                {episode.publishedAt ? formatRelativeTime(episode.publishedAt.toString()) : ''}
              </p>
            </Link>
          ) : null
        )}
      </div>
    </section>
  )
}