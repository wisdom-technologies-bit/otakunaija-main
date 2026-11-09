import Link from "next/link"
import Image from "next/image"
import { Countdown } from "@/components/episodes/countdown"
import { SectionTitle } from "@/components/episodes/section-title"
import { ScrollRow } from "@/components/shared/scroll-row"
import { daysUntil, type UpcomingItem } from "@/lib/anilist/upcoming"
import { FORMAT_LABELS } from "@/lib/upcoming-url"

type UpcomingEpisodeItem = {
  episode: {
    id: number
    slug: string
    title: string
    episodeNumber: number
    thumbnailUrl: string | null
    publishedAt: string | null
  }
  series: { slug: string; title: string; posterImageUrl: string | null; coverImageUrl: string | null } | null
}

const COUNTDOWN_WINDOW_DAYS = 30

/**
 * The /episodes "Upcoming" block: our own scheduled episodes first, then a rail
 * of AniList titles from the cache tables. Each part disappears when empty, so
 * the section never renders a stranded heading.
 */
export function UpcomingSection({
  episodes,
  anime,
  now,
}: {
  episodes: UpcomingEpisodeItem[]
  anime: UpcomingItem[]
  now: number
}) {
  const scheduled = episodes.filter((item) => item.series)
  const rail = anime.slice(0, 12)

  if (!scheduled.length && !rail.length) return null

  return (
    <div className="space-y-8">
      {scheduled.length ? (
        <section aria-labelledby="coming-up-on-otakunaija">
          <SectionTitle
            id="coming-up-on-otakunaija"
            title="Coming up on OtakuNaija"
            href="/episodes/new-releases"
          />
          <ScrollRow ariaLabel="Episodes coming up on OtakuNaija">
            {scheduled.map(({ episode, series }) =>
              series ? (
                <Link
                  key={episode.id}
                  href={`/episodes/${series.slug}/${episode.slug}`}
                  className="otk-focus group w-40 shrink-0"
                >
                  <div className="relative aspect-video w-40 overflow-hidden rounded-lg bg-muted">
                    {episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl ? (
                      <Image
                        src={episode.thumbnailUrl || series.posterImageUrl || series.coverImageUrl || ""}
                        alt={episode.title}
                        fill
                        sizes="160px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : (
                      <div className="flex h-full items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
                        <span className="text-xs text-muted-foreground">No image</span>
                      </div>
                    )}
                    <span className="absolute left-1.5 top-1.5 rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-black">
                      Soon
                    </span>
                    <span className="absolute right-1.5 top-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                      Ep {episode.episodeNumber}
                    </span>
                  </div>
                  <p className="mt-2 line-clamp-1 text-sm font-medium text-foreground group-hover:text-primary">
                    {series.title}
                  </p>
                  <p className="text-xs font-medium text-foreground">
                    <Countdown releaseAt={episode.publishedAt || ""} />
                  </p>
                </Link>
              ) : null,
            )}
          </ScrollRow>
        </section>
      ) : null}

      {rail.length ? (
        <section aria-labelledby="upcoming-anime-heading">
          <SectionTitle
            id="upcoming-anime-heading"
            title="Upcoming anime"
            href="/episodes/upcoming"
            action={
              <Link
                href="/episodes/upcoming"
                className="otk-focus text-sm font-semibold text-[var(--otk-accent)] hover:underline"
              >
                See all
              </Link>
            }
          />
          <ScrollRow ariaLabel="Upcoming anime release dates">
            {rail.map((item) => {
              const days = daysUntil(item, new Date(now))
              const showCountdown = days !== null && days >= 0 && days <= COUNTDOWN_WINDOW_DAYS
              return (
                <Link
                  key={item.anilistId}
                  href={item.href}
                  className="otk-focus group w-[8.5rem] shrink-0 sm:w-36"
                >
                  <div className="otk-card-media relative aspect-[2/3] w-full overflow-hidden rounded-[var(--otk-radius)]">
                    {item.coverUrl ? (
                      <Image
                        src={item.coverUrl}
                        alt=""
                        fill
                        sizes="144px"
                        className="object-cover transition-transform group-hover:scale-105"
                      />
                    ) : null}
                    <span className="otk-chip absolute left-1.5 top-1.5 bg-black/65 text-white backdrop-blur-sm">
                      {FORMAT_LABELS[item.format ?? ""] ?? item.format ?? "Anime"}
                    </span>
                    {item.onSite ? (
                      <span className="otk-chip otk-chip-accent absolute right-1.5 top-1.5">On OtakuNaija</span>
                    ) : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-sm font-medium text-foreground group-hover:text-primary">
                    {item.title}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1">
                    <span className={`otk-chip ${item.startDateIso ? "" : "otk-chip-status-upcoming"}`}>
                      {item.startDateIso ? item.startLabel : "TBA"}
                    </span>
                  </div>
                  {showCountdown && item.startDateIso ? (
                    <div className="mt-1.5">
                      <Countdown releaseAt={`${item.startDateIso}T00:00:00Z`} />
                    </div>
                  ) : null}
                </Link>
              )
            })}
          </ScrollRow>
        </section>
      ) : null}
    </div>
  )
}

export default UpcomingSection
