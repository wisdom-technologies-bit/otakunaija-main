import Image from "next/image"
import Link from "next/link"
import { Play } from "lucide-react"
import { RelativeTime } from "@/components/home/relative-time"
import {
  episodeCardModel,
  type EpisodeCardEpisodeInput,
  type EpisodeCardSeriesInput,
} from "@/lib/episode-card-model"
import { cn } from "@/lib/utils"

type EpisodeCardProps = {
  episode: EpisodeCardEpisodeInput
  series: EpisodeCardSeriesInput
  className?: string
  priority?: boolean
  /** Fixed clock for tests and deterministic renders. */
  now?: number
  sizes?: string
}

/**
 * The one episode card used by the home "Watch now" row and every episode
 * listing. 16:9 thumbnail, series title, episode number, relative time, a
 * "New" chip inside 24 hours and a duration when the catalogue has one.
 */
export function EpisodeCard({
  episode,
  series,
  className,
  priority = false,
  now,
  sizes = "(min-width: 1024px) 18rem, (min-width: 640px) 16rem, 72vw",
}: EpisodeCardProps) {
  const model = episodeCardModel(episode, series, now)

  return (
    <article className={cn("otk-card", className)} data-episode-card={episode.slug}>
      <Link
        href={model.href}
        className="otk-card-link otk-focus"
        aria-label={`${model.seriesTitle} ${model.epLabel}`}
      >
        <div className="otk-card-media aspect-video">
          {model.hasThumbnail && episode.thumbnailUrl ? (
            <Image
              src={episode.thumbnailUrl}
              alt=""
              fill
              sizes={sizes}
              priority={priority}
              loading={priority ? undefined : "lazy"}
              className="object-cover"
            />
          ) : (
            <div className="otk-cover-fallback otk-fallback-default" aria-hidden="true">
              <Play className="otk-cover-fallback-icon" strokeWidth={1.5} />
            </div>
          )}

          <span className="otk-ep-play" aria-hidden="true">
            <Play className="size-4" strokeWidth={2.5} />
          </span>

          <span className="otk-chip otk-chip-accent otk-ep-chip">{model.epLabel}</span>
          {model.isNew ? <span className="otk-chip otk-chip-new">New</span> : null}
          {model.durationLabel ? (
            <span className="otk-chip otk-chip-duration">{model.durationLabel}</span>
          ) : null}
        </div>

        <div className="otk-card-body">
          <h3 className="otk-card-title line-clamp-2">{model.seriesTitle}</h3>
          <p className="otk-card-meta">
            <span>{model.epLabel}</span>
            {model.publishedAtISO ? (
              <>
                <span aria-hidden="true">·</span>
                <RelativeTime date={model.publishedAtISO} />
              </>
            ) : null}
          </p>
        </div>
      </Link>
    </article>
  )
}

export default EpisodeCard
