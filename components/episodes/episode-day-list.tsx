import { EpisodeCard } from "@/components/episodes/episode-card"
import { groupByReleaseDay } from "@/lib/episode-day-groups"

type DayEpisode = {
  id: number
  slug: string
  title: string
  episodeNumber: number
  thumbnailUrl: string | null
  durationSeconds?: number | null
  publishedAt: string | null
}
type DaySeries = { slug: string; title: string } | null

/** Day-grouped new releases: Today, Yesterday, This week, Earlier. */
export function EpisodeDayList({
  items,
  now,
}: {
  items: { episode: DayEpisode; series: DaySeries }[]
  now?: number
}) {
  const groups = groupByReleaseDay(items, (item) => item.episode.publishedAt)

  return (
    <div className="space-y-10">
      {groups.map((group) => (
        <section key={group.key} aria-labelledby={`releases-${group.key}`}>
          <div className="otk-section-head">
            <h2 id={`releases-${group.key}`} className="otk-section-title text-xl">
              {group.label}
            </h2>
            <p className="otk-meta">
              {group.items.length} episode{group.items.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.items.map(({ episode, series }) =>
              series ? (
                <EpisodeCard key={episode.id} episode={episode} series={series} now={now} />
              ) : null,
            )}
          </div>
        </section>
      ))}
    </div>
  )
}

export default EpisodeDayList
