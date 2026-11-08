import Image from "next/image"
import Link from "next/link"
import type { Series } from "@/lib/db/schema"
import { cn } from "@/lib/utils"

interface SeriesCardProps {
  series: Series & { episodeCount?: number }
  creatorName?: string
  variant?: "poster" | "default"
  className?: string
  priority?: boolean
}

const STATUS_LABEL: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  upcoming: "Upcoming",
}

const STATUS_CLASS: Record<string, string> = {
  ongoing: "otk-chip-status-ongoing",
  completed: "otk-chip-status-completed",
  upcoming: "otk-chip-status-upcoming",
}

/** 2:3 catalogue poster with metadata always visible (no hover required). */
export function SeriesCard({ series, creatorName, variant = "poster", className, priority = false }: SeriesCardProps) {
  const genre = series.genre?.split(",")[0]?.trim() || "Anime"
  const status = series.status ?? "ongoing"
  const statusLabel = STATUS_LABEL[status] ?? status
  const episodeLabel =
    series.episodeCount !== undefined
      ? `${series.episodeCount} episode${series.episodeCount === 1 ? "" : "s"}`
      : null

  if (variant === "default") {
    return (
      <Link href={`/episodes/${series.slug}`} className={cn("otk-focus group block", className)}>
        <article className="otk-card">
          <div className="otk-card-media aspect-video">
            {series.coverImageUrl || series.posterImageUrl ? (
              <Image
                src={(series.coverImageUrl || series.posterImageUrl) as string}
                alt=""
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover"
              />
            ) : (
              <div className="otk-cover-fallback otk-fallback-default" aria-hidden="true">
                <span className="otk-cover-fallback-label">{series.title}</span>
              </div>
            )}
            <span className={cn("otk-chip", STATUS_CLASS[status])} style={{ position: "absolute", right: "0.5rem", top: "0.5rem", zIndex: 3 }}>
              {statusLabel}
            </span>
          </div>
          <div className="otk-card-body">
            <h3 className="otk-card-title line-clamp-2">{series.title}</h3>
            <p className="otk-card-meta">
              <span>{genre}</span>
              {episodeLabel ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>{episodeLabel}</span>
                </>
              ) : null}
              {creatorName ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>by {creatorName}</span>
                </>
              ) : null}
            </p>
          </div>
        </article>
      </Link>
    )
  }

  return (
    <Link href={`/episodes/${series.slug}`} className={cn("otk-focus group block", className)}>
      <article className="otk-card">
        <div className="otk-card-media aspect-[2/3]">
          {series.posterImageUrl ? (
            <Image
              src={series.posterImageUrl}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (min-width: 1280px) 18vw, 22vw"
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover"
            />
          ) : (
            <div className="otk-cover-fallback otk-fallback-default" aria-hidden="true">
              <span className="otk-cover-fallback-mark">OtakuNaija</span>
              <span className="otk-cover-fallback-label">{series.title.slice(0, 18)}</span>
            </div>
          )}

          {/* always-visible bottom gradient so metadata reads on any poster */}
          <span className="otk-poster-scrim" aria-hidden="true" />

          <span
            className={cn("otk-chip", STATUS_CLASS[status])}
            style={{ position: "absolute", right: "0.4rem", top: "0.4rem", zIndex: 3 }}
          >
            {statusLabel}
          </span>

          <div className="absolute inset-x-0 bottom-0 z-[2] flex items-end justify-between gap-1 p-2">
            <span className="otk-chip max-w-[62%] truncate">{genre}</span>
            {series.episodeCount !== undefined ? (
              <span className="otk-chip otk-chip-accent">Ep {series.episodeCount}</span>
            ) : null}
          </div>
        </div>

        <div className="otk-card-body">
          <h3 className="otk-card-title line-clamp-2">{series.title}</h3>
          <p className="otk-card-meta">
            <span>
              {episodeLabel ?? "New series"} · {statusLabel}
            </span>
          </p>
        </div>
      </article>
    </Link>
  )
}

export default SeriesCard
