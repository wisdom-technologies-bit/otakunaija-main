import { PostEditor, type NewsPrefill } from "@/components/admin/post-editor"

export const metadata = { title: "New Post" }

export default async function NewPostPage({
  searchParams,
}: {
  searchParams: Promise<{ newsId?: string }>
}) {
  const { newsId: rawNewsId } = await searchParams
  const newsId = Number(rawNewsId)
  const hasValidNewsId = Number.isInteger(newsId) && newsId > 0
  let newsPrefill: NewsPrefill | undefined
  let loadFailed = false

  if (hasValidNewsId) {
    try {
      const baseUrl = process.env.NEWS_API_URL
      const apiKey = process.env.NEWS_API_KEY
      if (!baseUrl || !apiKey) throw new Error("News API is not configured")

      const response = await fetch(`${baseUrl.replace(/\/$/, "")}/api/news/${newsId}`, {
        headers: { "X-News-Api-Key": apiKey },
        cache: "no-store",
        signal: AbortSignal.timeout(10_000),
      })
      if (!response.ok) throw new Error(`News API returned ${response.status}`)

      const item = (await response.json()) as {
        id: number
        title: string
        summary: string
        full_content?: string
        link: string
        image_url?: string | null
      }
      newsPrefill = {
        title: item.title,
        excerpt: item.summary,
        content: `Source: [${item.title}](${item.link})\n\n${item.summary}\n\n`,
        cover_image: item.image_url || undefined,
        newsId: item.id,
      }
    } catch {
      loadFailed = true
    }
  }

  return (
    <>
      {loadFailed ? (
        <div className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-500">
          Could not load the linked headline — starting with a blank post.
        </div>
      ) : null}
      <PostEditor mode="create" newsPrefill={newsPrefill} />
    </>
  )
}
