import Link from 'next/link'
import Image from 'next/image'
import { getRecentVideos } from '@/lib/db/queries'
import SectionTitle from '@/components/episodes/section-title'

function labelContentType(contentType: string) {
  return contentType.charAt(0).toUpperCase() + contentType.slice(1)
}

export async function MoviesRow() {
  const rows = await getRecentVideos(8)
  if (!rows.length) return null

  return (
    <section>
      <SectionTitle title="Movies, OVAs & Specials" href="/episodes/movies/browse" />
      <div className="flex w-full gap-4 overflow-x-auto overflow-y-hidden pb-2 touch-pan-x no-scrollbar">
        <div className="flex gap-4 min-w-max">
          {rows.map(({ video }) => (
            <Link key={video.id} href={`/episodes/movies/${video.slug}`} className="group w-[120px] shrink-0">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                <Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill unoptimized className="object-cover transition-transform group-hover:scale-105" sizes="120px" />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{labelContentType(video.contentType)}</span>
              </div>
              <p className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">{video.title}</p>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
