import { getAllSeriesWithEpisodesForSitemap } from "@/lib/db/queries"

const BASE = "https://otakunaija.name.ng"

export async function GET() {
  const allSeries = await getAllSeriesWithEpisodesForSitemap()

  // Flatten all episodes from every series
  const episodes = allSeries.flatMap((series) =>
    series.episodes.map((episode) => ({
      seriesTitle: series.title,
      seriesSlug: series.slug,
      episodeTitle: episode.title,
      episodeSlug: episode.slug,
      publishedAt: episode.publishedAt,
    }))
  )

  // Most recent 30 episodes
  const recentEpisodes = episodes
    .sort(
      (a, b) =>
        new Date(b.publishedAt ?? 0).getTime() -
        new Date(a.publishedAt ?? 0).getTime()
    )
    .slice(0, 30)

  const items = recentEpisodes
    .map(
      (episode) => `
    <item>
      <title><![CDATA[${episode.seriesTitle} - ${episode.episodeTitle}]]></title>
      <link>${BASE}/episodes/${episode.seriesSlug}/${episode.episodeSlug}</link>
      <guid isPermaLink="true">${BASE}/episodes/${episode.seriesSlug}/${episode.episodeSlug}</guid>
      <description><![CDATA[Latest episode release for ${episode.seriesTitle}.]]></description>
      <pubDate>${new Date(episode.publishedAt).toUTCString()}</pubDate>
      <category>Episodes</category>
    </item>`
    )
    .join("")

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>OtakuNaija Episodes</title>
    <link>${BASE}/episodes</link>
    <description>Latest anime episode releases on OtakuNaija.</description>
    <language>en</language>
    <atom:link href="${BASE}/episodes-rss.xml" rel="self" type="application/rss+xml" />
    ${items}
  </channel>
</rss>`

  return new Response(rss, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  })
}