import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { getPaginatedVideos } from '@/lib/db/queries'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'

export const metadata: Metadata = { title: 'Movies, OVAs & Specials' }

function labelContentType(contentType: string) {
  return contentType.charAt(0).toUpperCase() + contentType.slice(1)
}

export default async function MoviesBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Number(params.page || 1)
  const type = typeof params.contentType === 'string' ? params.contentType : undefined
  const { items, total, pageSize } = await getPaginatedVideos({ page, contentType: type })
  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-10">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">OtakuNaija cinema</p>
            <h1 className="text-3xl font-bold text-foreground md:text-4xl">Movies, OVAs &amp; Specials</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {['all', 'movie', 'ova', 'special'].map((value) => (
              <Link key={value} href={value === 'all' ? '/episodes/movies/browse' : `?contentType=${value}`} className="rounded-full border border-border px-3 py-1.5 hover:border-primary">
                {value === 'all' ? 'All' : value.toUpperCase()}
              </Link>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {items.map(({ video }) => (
            <Link key={video.id} href={`/episodes/movies/${video.slug}`} className="group">
              <div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted">
                <Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill unoptimized className="object-cover transition-transform group-hover:scale-105" sizes="(max-width: 640px) 50vw, 16vw" />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">{labelContentType(video.contentType)}</span>
              </div>
              <h2 className="mt-2 line-clamp-2 text-xs font-medium text-foreground group-hover:text-primary">{video.title}</h2>
            </Link>
          ))}
        </div>
        <div className="mt-10 flex justify-center gap-3 text-sm">
          {page > 1 && <Link className="rounded-full border border-border px-4 py-2 hover:border-primary" href={`?page=${page - 1}${type ? `&contentType=${type}` : ''}`}>Previous</Link>}
          {page < pages && <Link className="rounded-full border border-border px-4 py-2 hover:border-primary" href={`?page=${page + 1}${type ? `&contentType=${type}` : ''}`}>Next</Link>}
        </div>
      </main>
      <SiteFooter />
    </div>
  )
}
