import Link from 'next/link'
import Image from 'next/image'
import type { series as Series, creators as Creator } from '@/lib/db/schema'

interface OngoingSeriesScrollProps {
  items: { series: typeof Series.$inferSelect; creator: typeof Creator.$inferSelect | null }[]
}

export function OngoingSeriesScroll({ items }: OngoingSeriesScrollProps) {
  if (items.length === 0) return null

  // Duplicate the list so the CSS animation can loop seamlessly
  const looped = [...items, ...items]

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">Ongoing Series</h2>
        <Link href="/episodes/browse?status=ongoing" className="text-sm font-medium text-primary hover:underline">
          View All
        </Link>
      </div>
      <div className="group relative w-full overflow-x-hidden">
        <div className="flex min-w-max animate-scroll-x gap-4 will-change-transform group-hover:[animation-play-state:paused]">
          {looped.map(({ series: s }, i) => (
            <Link
              key={`${s.id}-${i}`}
              href={`/episodes/${s.slug}`}
              className="group/card w-44 flex-shrink-0"
            >
              <div className="relative aspect-video w-44 overflow-hidden rounded-lg bg-muted">
                {s.coverImageUrl ? (
                  <Image
                    src={s.coverImageUrl}
                    alt={s.title}
                    fill
                    className="object-cover transition-transform group-hover/card:scale-105"
                    sizes="176px"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                    <span className="text-xs text-muted-foreground">No image</span>
                  </div>
                )}
                <span className="absolute left-1.5 top-1.5 rounded bg-emerald-900/80 px-1.5 py-0.5 text-[10px] font-bold text-white">
                  Ongoing
                </span>
              </div>
              <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover/card:text-primary">
                {s.title}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}