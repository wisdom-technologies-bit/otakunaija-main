import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import {
  UPCOMING_CACHE_TAG,
  clampPageCap,
  refreshUpcoming,
} from "@/lib/anilist/upcoming-store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Comfortably inside a minute. Render ignores maxDuration; it is here for hosts
// that honour it. The refresh also stops itself after 45 s.
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

/**
 * Refreshes the AniList cache. This is the only place AniList is called, so
 * page renders never depend on it.
 *
 *   POST /api/cron/upcoming                    refresh the cache
 *   POST /api/cron/upcoming?dry=1              fetch + normalise, write nothing
 *   POST /api/cron/upcoming?limit=2            page cap per query
 */
async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const dry = params.get("dry") === "1"
  const limitParam = params.get("limit")
  const parsedLimit = limitParam === null ? undefined : Number.parseInt(limitParam, 10)
  const limit = Number.isFinite(parsedLimit) ? clampPageCap(parsedLimit) : undefined

  const result = await refreshUpcoming({ dry, limit })

  if (!dry && result.written) {
    // Tag first (data readers), then the two pages that show the data.
    revalidateTag(UPCOMING_CACHE_TAG, "max")
    revalidatePath("/episodes/upcoming")
    revalidatePath("/episodes")
  }

  const status = result.fetched === 0 && result.errors.length > 0 ? 502 : 200

  return NextResponse.json(
    {
      fetched: result.fetched,
      upserted: result.upserted,
      schedule: result.schedule,
      onSite: result.onSite,
      rateLimited: result.rateLimited,
      ms: result.ms,
      errors: result.errors,
      dry: result.dry,
      written: result.written,
    },
    { status },
  )
}
