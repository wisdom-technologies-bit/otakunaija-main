import Link from "next/link"
import { Countdown } from "@/components/episodes/countdown"
import { EpisodeCard } from "@/components/episodes/episode-card"
import { HomeSectionHeading } from "@/components/home/home-section-heading"
import { RelativeTime } from "@/components/home/relative-time"
import { ScrollRow } from "@/components/shared/scroll-row"
import { UpcomingAirTime } from "@/components/episodes/upcoming-air-time"
import type { AiringItem } from "@/lib/anilist/upcoming-store"

type WatchEpisode = {
  id: number
  slug: string
  title: string
  episodeNumber: number
  thumbnailUrl: string | null
  durationSeconds: number | null
  publishedAt: string | null
}

type WatchSeries = { slug: string; title: string } | null

export type WatchNowItem = { episode: WatchEpisode; series: WatchSeries }

type HomeWatchNowProps = {
  recent: WatchNowItem[]
  upcoming: WatchNowItem[]
  now: number
  /**
   * AniList episodes airing today, read from the cached upcoming tables. Only
   * used to top up the strip when our own scheduled episodes are thin.
   */
  airingToday?: AiringItem[]
}

/**
 * "Watch now": scroll-snap row of recent episodes plus a slim "Coming up"
 * strip with live countdowns. Hidden entirely when the catalogue is empty or
 * the queries failed.
 */
export function HomeWatchNow({ recent, upcoming, now, airingToday = [] }: HomeWatchNowProps) {
  const episodes = recent.filter((item) => item.series)
  const nextUp = upcoming.filter((item) => item.series).slice(0, 4)
  // Fill the strip with AniList airing-today titles when we have fewer than
  // four of our own scheduled episodes.
  const animeFill = nextUp.length < 4 ? airingToday.slice(0, 4 - nextUp.length) : []
  const hasComingUp = nextUp.length > 0 || animeFill.length > 0

  if (episodes.length === 0 && !hasComingUp) return null

  return (
    <section className="otk-section" aria-labelledby="home-watch-now-heading">
      <HomeSectionHeading
        eyebrow="From the catalogue"
        title="Watch now"
        href="/episodes"
        linkLabel="All episodes"
        id="home-watch-now-heading"
      />

      {episodes.length > 0 ? (
        <ScrollRow ariaLabel="Recently released episodes" fade>
          {episodes.map(({ episode, series }) => (
            <EpisodeCard
              key={episode.id}
              episode={{
                slug: episode.slug,
                title: episode.title,
                episodeNumber: episode.episodeNumber,
                thumbnailUrl: episode.thumbnailUrl,
                durationSeconds: episode.durationSeconds,
                publishedAt: episode.publishedAt,
              }}
              series={series}
              now={now}
              className="w-[72vw] shrink-0 sm:w-60 lg:w-64"
            />
          ))}
        </ScrollRow>
      ) : null}

      {hasComingUp ? (
        <div className="otk-coming-up">
          <div className="flex items-center justify-between gap-3">
            <p className="otk-eyebrow">Coming up</p>
            <Link
              href="/episodes/upcoming"
              className="otk-focus text-xs font-semibold text-[var(--otk-accent)] hover:underline"
            >
              See all upcoming
            </Link>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            {nextUp.map(({ episode, series }) => (
              <li
                key={episode.id}
                className="min-w-0 rounded-[var(--otk-radius)] border border-[var(--otk-border)] bg-[var(--otk-surface)] p-2.5"
              >
                <Link href={`/episodes/${series?.slug}/${episode.slug}`} className="otk-focus block">
                  <span className="block truncate text-xs font-bold text-[var(--otk-text)]">
                    {series?.title}
                  </span>
                  <span className="otk-meta mt-0.5">
                    <span>Ep {episode.episodeNumber}</span>
                    {episode.publishedAt ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <RelativeTime date={episode.publishedAt} />
                      </>
                    ) : null}
                  </span>
                </Link>
                {episode.publishedAt ? (
                  <div className="mt-2">
                    <Countdown releaseAt={episode.publishedAt} />
                  </div>
                ) : null}
              </li>
            ))}
            {animeFill.map((item) => {
              const body = (
                <>
                  <span className="block truncate text-xs font-bold text-[var(--otk-text)]">
                    {item.title}
                  </span>
                  <span className="otk-meta mt-0.5">
                    <span>Ep {item.episode}</span>
                    <span aria-hidden="true">·</span>
                    <UpcomingAirTime airingAt={item.airingAt} />
                  </span>
                  {item.onSite ? <span className="otk-chip otk-chip-accent mt-1">On OtakuNaija</span> : null}
                </>
              )

              return (
                <li
                  key={`anilist-${item.anilistId}-${item.episode}`}
                  className="min-w-0 rounded-[var(--otk-radius)] border border-[var(--otk-border)] bg-[var(--otk-surface)] p-2.5"
                >
                  {item.onSite ? (
                    <Link href={item.href} className="otk-focus block">
                      {body}
                    </Link>
                  ) : (
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="otk-focus block"
                    >
                      {body}
                    </a>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

export default HomeWatchNow
