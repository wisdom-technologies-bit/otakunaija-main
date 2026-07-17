import Link from "next/link"
import Image from "next/image"
import { ExternalLink, Plus } from "lucide-react"
import { getAllCreators, getSeriesCountForCreator } from "@/lib/db/queries"
import { DeleteCreatorButton } from "@/components/admin/delete-creator-button"

export const metadata = { title: "Creators" }

export default async function CreatorsPage() {
  const creators = await getAllCreators()
  const creatorsWithCounts = await Promise.all(
    creators.map(async (creator) => ({
      ...creator,
      seriesCount: await getSeriesCountForCreator(creator.id),
    }))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl md:text-3xl font-bold">Creators</h1>
          <p className="text-sm text-muted-foreground">{creators.length} creators</p>
        </div>
        <Link
          href="/admin/creators/new"
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="h-4 w-4" /> New Creator
        </Link>
      </div>

      <section className="rounded-xl border border-border bg-card">
        <div className="divide-y divide-border">
          {creatorsWithCounts.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">
              No creators yet.{" "}
              <Link href="/admin/creators/new" className="text-primary hover:underline">
                Add your first creator
              </Link>
              .
            </div>
          ) : (
            <div className="space-y-1">
              {creatorsWithCounts.map((creator) => (
                <div key={creator.id} className="flex flex-col md:flex-row items-start md:items-center gap-3 px-4 py-3 hover:bg-background/50">
                  {/* Avatar */}
                  {creator.avatar_url && (
                    <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
                      <Image
                        src={creator.avatar_url}
                        alt={creator.name}
                        fill
                        className="object-cover"
                        sizes="40px"
                        unoptimized
                      />
                    </div>
                  )}
                  
                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <Link
                      href={`/admin/creators/${creator.id}/edit`}
                      className="text-sm font-medium hover:text-primary"
                    >
                      {creator.name}
                    </Link>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {creator.slug} · {creator.seriesCount} series
                    </p>
                  </div>

                  {/* Facebook link */}
                  {creator.facebook_url && (
                    <a
                      href={creator.facebook_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="h-8 w-8 text-muted-foreground hover:text-primary flex items-center justify-center"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}

                  {/* Actions */}
                  <div className="flex items-center gap-1 ml-auto">
                    <Link
                      href={`/admin/creators/${creator.id}/edit`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                    >
                      ✏️
                    </Link>
                    <DeleteCreatorButton id={creator.id} name={creator.name} />
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
