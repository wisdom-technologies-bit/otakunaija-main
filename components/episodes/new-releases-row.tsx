import { EpisodeCard } from "@/components/episodes/episode-card"
import { SectionTitle } from "@/components/episodes/section-title"
import { ScrollRow } from "@/components/shared/scroll-row"

type ReleaseEpisode = {
  id: number
  slug: string
  title: string
  episodeNumber: number
  thumbnailUrl: string | null
  durationSeconds?: number | null
  publishedAt: string | null
}
type ReleaseSeries = { slug: string; title: string } | null

export function NewReleasesRow({
  items,
  now,
}: {
  items: { episode: ReleaseEpisode; series: ReleaseSeries }[]
  now?: number
}) {
  const rows = items.filter((item) => item.series)
  if (rows.length === 0) return null

  return (
    <section aria-labelledby="new-releases-heading">
      <SectionTitle title="New releases" href="/episodes/new-releases" />
      <h2 id="new-releases-heading" className="sr-only">
        New releases
      </h2>
      <ScrollRow ariaLabel="New releases" fade>
        {rows.map(({ episode, series }) => (
          <EpisodeCard
            key={episode.id}
            episode={episode}
            series={series}
            now={now}
            className="w-[72vw] shrink-0 sm:w-60 lg:w-64"
          />
        ))}
      </ScrollRow>
    </section>
  )
}
