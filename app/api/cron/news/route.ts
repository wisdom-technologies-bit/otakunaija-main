import { NextRequest, NextResponse } from "next/server"
import { runNewsIngest } from "@/lib/news/ingest"
import { revalidateBlogCaches } from "@/lib/news/revalidate"

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

  if (!dry && !process.env.GROQ_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "GROQ_API_KEY is not configured", dry, fetched: 0, new: 0, published: 0, rewritten: 0, failed: 0, skipped: 0, remaining: 0 },
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

  const status = result.error && result.fetched === 0 ? 502 : 200
  return NextResponse.json(result, { status })
}
