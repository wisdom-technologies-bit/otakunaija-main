import { notFound } from "next/navigation"
import { PostEditor } from "@/components/admin/post-editor"
import { getAdminPostById } from "@/lib/admin-queries"

export const metadata = { title: "Edit Post" }

type Params = Promise<{ id: string }>
type SearchParams = Promise<{ created?: string }>

export default async function EditPostPage({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}) {
  const { id } = await params
  const { created } = await searchParams
  const post = await getAdminPostById(Number(id))
  if (!post) notFound()
  return <PostEditor mode="edit" post={post} justCreated={created === "1"} />
}
