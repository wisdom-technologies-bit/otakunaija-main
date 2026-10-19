'use client'

import Image from 'next/image'
import Link from 'next/link'
import SectionTitle from '@/components/episodes/section-title'

type PopularSeries = {
  slug: string
  title: string
  posterImageUrl: string | null
  genre: string | null
  latestEpisodeNumber: number | null
  todayViews: number
}

export function PopularTodayRow({ items }: { items: PopularSeries[] }) {
  if (!items.length) return null

  return (
    <section aria-labelledby="popular-today-heading">
      <SectionTitle title="Popular Today" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        {items.map((item) => (
          <Link key={item.slug} href={`/episodes/${item.slug}`} className="group min-w-0">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
              <Image
                src={item.posterImageUrl ?? '/placeholder.svg'}
                alt={item.title}
                fill
                sizes="(min-width: 1024px) 20vw, (min-width: 640px) 25vw, 50vw"
                className="object-cover transition-transform group-hover:scale-105"
              />
              {item.genre && <span className="absolute bottom-2 left-2 max-w-[calc(100%-1rem)] truncate rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">{item.genre.split(',')[0]}</span>}
              <span className="absolute right-2 top-2 rounded bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">{item.todayViews} today</span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium group-hover:text-primary">{item.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
