import { getAllCreators } from "@/lib/db/queries"
import { SeriesEditor } from "@/components/admin/series-editor"

export const metadata = { title: "New Series" }

export default async function NewSeriesPage() {
  const creators = await getAllCreators()
  return <SeriesEditor mode="create" creators={creators} />
}
