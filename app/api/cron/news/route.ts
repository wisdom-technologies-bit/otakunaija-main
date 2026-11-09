import { NextRequest, NextResponse } from "next/server"
import { runNewsIngest } from "@/lib/news/ingest"
import { revalidateBlogCaches } from "@/lib/news/revalidate"
import { AUTO_BACKFILL_LIMIT, backfillMissingCovers, clampBackfillLimit } from "@/lib/news/backfill"
import { fetchArticle } from "@/lib/news/ann"
import { copyImageToCloudinary } from "@/lib/news/image"
import { listPostsMissingCover, updatePostCover } from "@/lib/news/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Article fetch + one Groq call is comfortably inside a minute; the pipeline
// also stops itself after DEFAULT_DEADLINE_MS to leave headroom.
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const dry = params.get("dry") === "1"
  const forceGuid = params.get("force_guid")
  const limitParam = params.get("limit")
  const limit = limitParam ? Number.parseInt(limitParam, 10) : undefined

  if (params.get("backfill_images") === "1") {
    const requested = Number.parseInt(params.get("limit") ?? "", 10)
    const backfill = await backfillMissingCovers({
      limit: Number.isFinite(requested) ? clampBackfillLimit(requested) : undefined,
      dry,
      store: { listPostsMissingCover, updatePostCover },
      fetchArticle,
      copyImage: copyImageToCloudinary,
    })
    return NextResponse.json(backfill, { status: 200 })
  }

  if (!dry && !process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured", dry, fetched: 0, new: 0, published: 0, rewritten: 0, failed: 0, skipped: 0, remaining: 0, image_reasons: {} },
      { status: 500 },
    )
  }

  const result = await runNewsIngest({
    dry,
    limit: Number.isFinite(limit) ? limit : undefined,
    forceGuid,
  })

  if (!result.dry && result.published > 0) {
    revalidateBlogCaches()
  }

  // Heal a couple of old cover-less posts on every real run.
  const backfill = result.dry
    ? null
    : await backfillMissingCovers({
        limit: AUTO_BACKFILL_LIMIT,
        dry: false,
        store: { listPostsMissingCover, updatePostCover },
        fetchArticle,
        copyImage: copyImageToCloudinary,
      })

  const status = result.error && result.fetched === 0 ? 502 : 200
  return NextResponse.json(
    {
      ...result,
      image_reasons: result.imageReasons,
      backfill: backfill
        ? { checked: backfill.checked, updated: backfill.updated, failed: backfill.failed, reasons: backfill.reasons }
        : null,
    },
    { status },
  )
}
