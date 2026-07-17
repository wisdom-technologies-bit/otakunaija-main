import { getAllSeriesForAdmin } from "@/lib/db/queries"
import { EpisodeEditor } from "@/components/admin/episode-editor"

export const metadata = { title: "New Episode" }

export default async function NewEpisodePage() {
  const seriesData = await getAllSeriesForAdmin()
  const series = seriesData.map((s) => s.series)
  return <EpisodeEditor mode="create" series={series} />
}
