import Link from "next/link"
import Image from "next/image"
import { ExternalLink, Plus } from "lucide-react"
import { getAllSeriesForAdmin, getAllCreators, getEpisodesCountForSeries } from "@/lib/db/queries"
import { DeleteSeriesButton } from "@/components/admin/delete-series-button"

export const metadata = { title: "Series" }

export default async function SeriesPage() {
  const [seriesData, creators] = await Promise.all([
    getAllSeriesForAdmin(),
    getAllCreators(),
  ])

  const seriesWithCounts = await Promise.all(
    seriesData.map(async (s) => ({
      ...s,
      episodeCount: await getEpisodesCountForSeries(s.series.id),
    }))
  )

  const hasCreators = creators.length > 0

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Series</h1>
          <p className="text-sm text-muted-foreground">{seriesWithCounts.length} series</p>
        </div>
        {hasCreators ? (
          <Link
            href="/admin/series/new"
            className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="h-4 w-4" /> New Series
          </Link>
        ) : null}
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="divide-y divide-border">
          {seriesWithCounts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              {hasCreators ? (
                <>
                  No series yet.{" "}
                  <Link href="/admin/series/new" className="text-primary hover:underline">
                    Add your first series
                  </Link>
                  .
                </>
              ) : (
                <>
                  No creators yet. Create a creator first before adding series.{" "}
                  <Link href="/admin/creators/new" className="text-primary hover:underline">
                    Add your first creator
                  </Link>
                  .
                </>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {seriesWithCounts.map(({ series: s, creator, episodeCount }) => (
                <div key={s.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 px-4 py-3 hover:bg-background/50">
                  {/* Cover */}
                  {s.coverImageUrl && (
                    <div className="relative h-12 w-20 flex-shrink-0 overflow-hidden rounded bg-muted">
                      <Image
                        src={s.coverImageUrl}
                        alt={s.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                        unoptimized
                      />
                    </div>
                  )}

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/series/${s.id}/edit`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {s.title}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {creator?.name || "Unknown"} · {s.genre} · {episodeCount} episodes
                      {s.status === "completed" && " · Completed"}
                    </p>
                  </div>

                  {/* Status badge */}
                  <span
                    className={`inline-flex px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${
                      s.status === "completed"
                        ? "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                        : "bg-green-500/15 text-green-700 dark:text-green-300"
                    }`}
                  >
                    {s.status === "completed" ? "Completed" : "Ongoing"}
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-auto">
                    <a
                      href={`/episodes/${s.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                      title="View live"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <Link
                      href={`/admin/series/${s.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      ✏️
                    </Link>
                    <DeleteSeriesButton id={s.id} title={s.title} />
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
