import Link from 'next/link'
import Image from 'next/image'
import { Countdown } from '@/components/episodes/countdown'
import { formatReleaseDate } from '@/lib/format-date'

type UpcomingItem = { episode: { id: number; slug: string; title: string; episodeNumber: number; thumbnailUrl: string | null; publishedAt: string | null }; series: { slug: string; title: string; posterImageUrl: string | null; coverImageUrl: string | null } | null }

export function UpcomingRow({ items }: { items: UpcomingItem[] }) {
  if (!items.length) return null
  return <section>
    <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-bold text-foreground md:text-2xl">Upcoming</h2><Link href="/episodes/new-releases" className="text-sm font-medium text-primary hover:underline">View All</Link></div>
    <div className="flex w-full gap-4 overflow-x-auto overflow-y-hidden pb-2 touch-pan-x"><div className="flex gap-4 min-w-max">
      {items.map(({ episode, series }) => series ? <Link key={episode.id} href={`/episodes/${series.slug}/${episode.slug}`} className="group w-40 flex-shrink-0">
        <div className="relative aspect-video w-40 overflow-hidden rounded-lg bg-muted">
          {(episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl) ? <Image src={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || ''} alt={episode.title} fill className="object-cover transition-transform group-hover:scale-105" sizes="160px" /> : <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"><span className="text-xs text-muted-foreground">No image</span></div>}
          <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">Soon</span>
          <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">Ep {episode.episodeNumber}</span>
        </div>
        <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">{series.title}</p>
        <p className="text-xs font-medium text-foreground"><Countdown releaseAt={episode.publishedAt || ''} /></p>
        <p className="text-xs text-muted-foreground">{episode.publishedAt ? formatReleaseDate(episode.publishedAt) : ''}</p>
      </Link> : null)}
    </div></div>
  </section>
}
