import { getEpisodeById, getAllSeriesForAdmin } from "@/lib/db/queries"
import { EpisodeEditor } from "@/components/admin/episode-editor"
import { notFound } from "next/navigation"

export const metadata = { title: "Edit Episode" }

export default async function EditEpisodePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  const [episode, seriesData] = await Promise.all([
    getEpisodeById(Number(id)),
    getAllSeriesForAdmin(),
  ])

  if (!episode) {
    notFound()
  }

  const series = seriesData.map((s) => s.series)

  return <EpisodeEditor mode="edit" episode={episode} series={series} justCreated={!!created} />
}
