import Link from "next/link"
import Image from "next/image"
import { getPaginatedVideos } from "@/lib/db/queries"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"

export const metadata = { title: "Movies, OVAs & Specials" }
export default async function MoviesBrowsePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams
  const page = Number(params.page || 1)
  const type = typeof params.contentType === "string" ? params.contentType : undefined
  const { items, total, pageSize } = await getPaginatedVideos({ page, contentType: type })
  const pages = Math.max(1, Math.ceil(total / pageSize))
  return <div className="min-h-screen flex flex-col bg-background"><SiteHeader /><main className="container mx-auto px-4 py-10"><div className="mb-8 flex flex-wrap items-end justify-between gap-4"><div><p className="text-sm font-semibold uppercase tracking-widest text-primary">OtakuNaija cinema</p><h1 className="font-display text-3xl font-bold md:text-4xl">Movies, OVAs & Specials</h1></div><div className="flex gap-2 text-sm">{["all","movie","ova","special"].map((value) => <Link key={value} href={value === "all" ? "/episodes/movies/browse" : `?contentType=${value}`} className="rounded-full border border-border px-3 py-1.5 hover:border-primary">{value === "all" ? "All" : value.toUpperCase()}</Link>)}</div></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">{items.map(({ video }) => <Link key={video.id} href={`/episodes/movies/${video.slug}`} className="group"><div className="relative aspect-[2/3] overflow-hidden rounded-lg bg-muted"><Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill unoptimized className="object-cover transition duration-300 group-hover:scale-105" sizes="(max-width: 640px) 50vw, 16vw" /><span className="absolute left-2 top-2 rounded bg-primary px-2 py-1 text-[10px] font-bold uppercase text-primary-foreground">{video.contentType}</span></div><h2 className="mt-2 line-clamp-2 text-sm font-semibold group-hover:text-primary">{video.title}</h2></Link>)}</div><div className="mt-10 flex justify-center gap-3 text-sm">{page > 1 && <Link className="rounded border px-4 py-2" href={`?page=${page - 1}${type ? `&contentType=${type}` : ""}`}>Previous</Link>}{page < pages && <Link className="rounded border px-4 py-2" href={`?page=${page + 1}${type ? `&contentType=${type}` : ""}`}>Next</Link>}</div></main><SiteFooter /></div>
} 
