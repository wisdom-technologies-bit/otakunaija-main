import { getCreatorById } from "@/lib/db/queries"
import { CreatorEditor } from "@/components/admin/creator-editor"
import { notFound } from "next/navigation"

export const metadata = { title: "Edit Creator" }

export default async function EditCreatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ created?: string }>
}) {
  const { id } = await params
  const { created } = await searchParams
  const creator = await getCreatorById(Number(id))

  if (!creator) {
    notFound()
  }

  return <CreatorEditor mode="edit" creator={creator} justCreated={!!created} />
}
