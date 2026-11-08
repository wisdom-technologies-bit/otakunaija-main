import { NextResponse } from "next/server"
import { requireAdminNewsSession } from "@/lib/news-proxy"
import { copyImageToCloudinary } from "@/lib/news/image"
import { publishIngestRow } from "@/lib/news/publish"
import { revalidateBlogCaches } from "@/lib/news/revalidate"
import { sqlStore } from "@/lib/news/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Body = { action?: string }

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const unauthorized = await requireAdminNewsSession()
  if (unauthorized) return unauthorized

  const { id: rawId } = await context.params
  const id = Number.parseInt(rawId, 10)
  if (!Number.isFinite(id) || id <= 0) {
    return NextResponse.json({ error: "INVALID_ID" }, { status: 400 })
  }

  const body = (await request.json().catch(() => ({}))) as Body
  const action = body.action

  const row = await sqlStore.getRow(id)
  if (!row) return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })

  if (action === "retry") {
    // Reset the attempt counter so the cron gives it the full three tries again.
    await sqlStore.setStatus(id, "pending", { attempts: 0, error: null })
    return NextResponse.json({ ok: true, status: "pending" })
  }

  if (action === "skip") {
    await sqlStore.setStatus(id, "skipped", { error: "skipped_by_admin" })
    return NextResponse.json({ ok: true, status: "skipped" })
  }

  if (action === "publish") {
    if (!row.rewritten) {
      return NextResponse.json({ error: "NOT_REWRITTEN", message: "No rewritten draft yet." }, { status: 409 })
    }

    const result = await publishIngestRow(row, { store: sqlStore, copyImage: copyImageToCloudinary })
    if (!result.ok) {
      return NextResponse.json({ error: "PUBLISH_FAILED", message: result.error }, { status: 500 })
    }

    revalidateBlogCaches()

    return NextResponse.json({ ok: true, status: "published", postId: result.postId, slug: result.slug })
  }

  return NextResponse.json({ error: "UNKNOWN_ACTION" }, { status: 400 })
}
