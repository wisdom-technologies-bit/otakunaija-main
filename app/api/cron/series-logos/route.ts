import { NextRequest, NextResponse } from "next/server"
import { revalidatePath, revalidateTag } from "next/cache"
import { DEFAULT_BATCH, MAX_BATCH, fillSeriesLogos } from "@/lib/tmdb/fill"
import { tmdbConfigured } from "@/lib/tmdb/logos"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// Comfortably inside a minute; the job also stops itself after 45 s.
export const maxDuration = 60

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return request.headers.get("authorization") === `Bearer ${secret}`
}

function parseBatch(raw: string | null): number {
  if (raw === null) return DEFAULT_BATCH
  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed)) return DEFAULT_BATCH
  return Math.min(MAX_BATCH, Math.max(1, parsed))
}

export async function GET(request: NextRequest) {
  return handle(request)
}

export async function POST(request: NextRequest) {
  return handle(request)
}

/**
 * Fills `series.logo_*` from TMDB. The only place TMDB is called, so page
 * renders never depend on it.
 *
 *   POST /api/cron/series-logos                 next 20 unchecked series
 *   POST /api/cron/series-logos?batch=40        up to 60
 *   POST /api/cron/series-logos?anilist_id=21   one series
 *   POST /api/cron/series-logos?force=1         re-check rows that already have a logo
 *   POST /api/cron/series-logos?dry=1           list the work, write nothing
 */
async function handle(request: NextRequest) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const params = request.nextUrl.searchParams
  const force = params.get("force") === "1"
  const dry = params.get("dry") === "1"
  const batch = parseBatch(params.get("batch"))
  const anilistRaw = params.get("anilist_id")
  const anilistId = anilistRaw && /^\d+$/.test(anilistRaw) ? Number(anilistRaw) : null

  const started = Date.now()
  const result = await fillSeriesLogos({ batch, anilistId, force, dry })
  const disabled = !tmdbConfigured()

  if (!dry && result.found > 0) {
    revalidateTag("series", "max")
    revalidatePath("/episodes")
    revalidatePath("/episodes/browse")
  }

  return NextResponse.json({
    claimed: result.claimed,
    found: result.found,
    none: result.none,
    errors: result.errors,
    skipped: result.skipped,
    rateLimited: result.rateLimited,
    remaining: result.remaining,
    dry: result.dry,
    force,
    batch,
    anilistId,
    disabled,
    ...(result.retryAfterMs ? { retryAfterMs: result.retryAfterMs } : {}),
    ms: result.ms || Date.now() - started,
  })
}
