import { CreatorEditor } from "@/components/admin/creator-editor"

export const metadata = { title: "New Creator" }

export default function NewCreatorPage() {
  return <CreatorEditor mode="create" />
}
