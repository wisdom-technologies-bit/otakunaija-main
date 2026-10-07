import Link from 'next/link'
import Image from 'next/image'
import { getTopSeriesByGenre } from '@/lib/db/queries'

export async function GenreRow({ genre }: { genre: string }) {
  const items = await getTopSeriesByGenre(genre)
  if (items.length < 3) return null

  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground md:text-2xl">{genre}</h2>
        <Link href={`/episodes/browse?genre=${encodeURIComponent(genre)}`} className="text-sm font-medium text-primary hover:underline">View All</Link>
      </div>
      <div className="flex w-full snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {items.map(({ series, latestEpisodeNumber }, index) => (
          <Link key={series.id} href={`/episodes/${series.slug}`} className="group w-[120px] shrink-0 snap-start">
            <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
              {series.posterImageUrl || series.coverImageUrl ? (
                <Image src={series.posterImageUrl || series.coverImageUrl!} alt={series.title} fill className="object-cover transition-transform group-hover:scale-105" sizes="120px" />
              ) : <div className="h-full bg-gradient-to-br from-primary/20 to-primary/5" />}
              <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
              {latestEpisodeNumber !== null && <span className="absolute bottom-1.5 left-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">Ep {latestEpisodeNumber}</span>}
            </div>
            <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">{series.title}</p>
          </Link>
        ))}
      </div>
    </section>
  )
}
