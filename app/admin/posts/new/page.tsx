import { PostEditor } from "@/components/admin/post-editor"

export const metadata = { title: "New Post" }

export default function NewPostPage() {
  return <PostEditor mode="create" />
}
