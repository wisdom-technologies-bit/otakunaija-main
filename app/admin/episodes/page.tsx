import Link from "next/link"
import Image from "next/image"
import { ExternalLink, Plus } from "lucide-react"
import { getAllEpisodesForAdmin, getAllSeriesForAdmin } from "@/lib/db/queries"
import { DeleteEpisodeButton } from "@/components/admin/delete-episode-button"

export const metadata = { title: "Episodes" }

export default async function EpisodesPage() {
  const [episodesData, seriesData] = await Promise.all([
    getAllEpisodesForAdmin(),
    getAllSeriesForAdmin(),
  ])

  const hasSeriesCreated = seriesData.length > 0

  // Format duration
  const formatDuration = (seconds: number | null): string => {
    if (!seconds) return "—"
    const hrs = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`
    }
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Episodes</h1>
          <p className="text-sm text-muted-foreground">{episodesData.length} episodes</p>
        </div>
        {hasSeriesCreated ? (
          <Link
            href="/admin/episodes/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Episode
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="divide-y divide-border overflow-x-auto">
          {episodesData.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {hasSeriesCreated ? (
                <>
                  No episodes yet.{" "}
                  <Link href="/admin/episodes/new" className="text-primary hover:underline">
                    Add your first episode
                  </Link>
                  .
                </>
              ) : (
                <>
                  No series yet. Create a series first before adding episodes.{" "}
                  <Link href="/admin/series/new" className="text-primary hover:underline">
                    Add your first series
                  </Link>
                  .
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {episodesData.map(({ episode: ep, series: s }) => (
                <div key={ep.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 px-4 py-3 hover:bg-background/50">
                  {/* Thumbnail + Episode number */}
                  <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded bg-muted">
                    {ep.thumbnailUrl && (
                      <Image
                        src={ep.thumbnailUrl}
                        alt={ep.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized
                      />
                    )}
                    <div className="absolute bottom-1 right-1 rounded bg-black/60 px-1.5 py-0.5 text-xs font-bold text-white">
                      EP {ep.episodeNumber}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/episodes/${ep.id}/edit`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {ep.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s?.title || "Unknown"} · {formatDuration(ep.durationSeconds)} · {ep.viewCount?.toLocaleString()} views
                    </p>
                  </div>

                  {/* Published date */}
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {new Date(ep.publishedAt).toLocaleDateString()}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-auto">
                    <a
                      href={`/episodes/${s?.slug}/${ep.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                      title="View live"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Link
                      href={`/admin/episodes/${ep.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      ✏️
                    </Link>
                    <DeleteEpisodeButton id={ep.id} title={ep.title} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
