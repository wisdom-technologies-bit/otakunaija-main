import Image from "next/image"
import Link from "next/link"
import { formatDuration } from "@/lib/episode-utils"
import { cn } from "@/lib/utils"

export type MovieCardVideo = {
  id: number
  slug: string
  title: string
  contentType: string
  posterImageUrl: string | null
  thumbnailUrl: string
  durationSeconds: number | null
  publishedAt: Date | string | null
}

const TYPE_LABEL: Record<string, string> = {
  movie: "Movie",
  ova: "OVA",
  special: "Special",
}

function runtime(seconds: number | null) {
  if (!seconds || seconds <= 0) return null
  if (seconds < 3600) return formatDuration(seconds)
  return `${Math.floor(seconds / 3600)}h ${Math.round((seconds % 3600) / 60)}m`
}

/** Movie poster using the same card language as series. */
export function MovieCard({ video, className }: { video: MovieCardVideo; className?: string }) {
  const typeLabel = TYPE_LABEL[video.contentType] ?? video.contentType
  const year = video.publishedAt ? new Date(video.publishedAt).getUTCFullYear() : null
  const length = runtime(video.durationSeconds)
  const poster = video.posterImageUrl || video.thumbnailUrl

  return (
    <Link href={`/episodes/movies/${video.slug}`} className={cn("otk-focus group block", className)}>
      <article className="otk-card">
        <div className="otk-card-media aspect-[2/3]">
          {poster ? (
            <Image
              src={poster}
              alt=""
              fill
              sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, (min-width: 1280px) 16vw, 20vw"
              loading="lazy"
              unoptimized
              className="object-cover"
            />
          ) : (
            <div className="otk-cover-fallback otk-fallback-default" aria-hidden="true">
              <span className="otk-cover-fallback-label">{video.title.slice(0, 18)}</span>
            </div>
          )}
          <span className="otk-poster-scrim" aria-hidden="true" />
          <span
            className="otk-chip"
            style={{ position: "absolute", left: "0.4rem", top: "0.4rem", zIndex: 3 }}
          >
            {typeLabel}
          </span>
        </div>
        <div className="otk-card-body">
          <h3 className="otk-card-title line-clamp-2">{video.title}</h3>
          <p className="otk-card-meta">
            <span>{typeLabel}</span>
            {year ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{year}</span>
              </>
            ) : null}
            {length ? (
              <>
                <span aria-hidden="true">·</span>
                <span>{length}</span>
              </>
            ) : null}
          </p>
        </div>
      </article>
    </Link>
  )
}

export default MovieCard
