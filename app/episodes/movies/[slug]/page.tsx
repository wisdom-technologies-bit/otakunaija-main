import Link from "next/link"
import { notFound } from "next/navigation"
import { getVideoBySlug } from "@/lib/db/queries"
import { VideoPlayer } from "@/components/episodes/video-player"

export default async function MoviePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const result = await getVideoBySlug(slug)
  if (!result) notFound()
  const { video, parentSeries } = result
  const canonical = `/episodes/movies/${video.slug}`
  return <main className="container mx-auto max-w-6xl px-4 py-8"><VideoPlayer videoUrl={video.videoUrl ?? null} thumbnailUrl={video.thumbnailUrl} title={video.title} subtitlesUrl={video.subtitlesUrl ?? null} playId={video.playId ?? null} /><article className="mt-8 max-w-3xl"><p className="text-sm font-semibold uppercase tracking-widest text-primary">{video.contentType} {video.genre ? `· ${video.genre}` : ""}</p><h1 className="mt-2 font-display text-3xl font-bold md:text-5xl">{video.title}</h1><p className="mt-5 leading-7 text-muted-foreground">{video.synopsis || "Watch this title on OtakuNaija."}</p><div className="mt-5 flex flex-wrap gap-3 text-sm text-muted-foreground"><span>{video.durationSeconds ? `${Math.floor(video.durationSeconds / 60)} min` : "Duration unavailable"}</span>{parentSeries && <Link className="text-primary hover:underline" href={`/episodes/${parentSeries.slug}`}>Part of {parentSeries.title}</Link>}</div></article><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(video.contentType === "movie" ? { "@context": "https://schema.org", "@type": "Movie", name: video.title, description: video.synopsis, contentUrl: video.videoUrl || undefined, url: canonical } : { "@context": "https://schema.org", "@type": "VideoObject", name: video.title, description: video.synopsis, ...(video.videoUrl ? { contentUrl: video.videoUrl } : { embedUrl: canonical }), thumbnailUrl: video.thumbnailUrl, url: canonical }) }} /></main>
}
