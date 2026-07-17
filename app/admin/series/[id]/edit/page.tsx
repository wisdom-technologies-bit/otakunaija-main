import { getSeriesById, getAllCreators } from "@/lib/db/queries"
import { SeriesEditor } from "@/components/admin/series-editor"
import { notFound } from "next/navigation"

export const metadata = { title: "Edit Series" }

export default async function EditSeriesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  const [series, creators] = await Promise.all([
    getSeriesById(Number(id)),
    getAllCreators(),
  ])

  if (!series) {
    notFound()
  }

  return <SeriesEditor mode="edit" series={series} creators={creators} justCreated={!!created} />
}
