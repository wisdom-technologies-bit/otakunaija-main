import { NextRequest, NextResponse } from "next/server"
import { newsletterConfig } from "@/lib/newsletter/config"
import { prepareRuntime, sendRuntime } from "@/lib/newsletter/runtime"
import { getSetting } from "@/lib/newsletter/store"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
// prepare: content reads + one Groq call + one React Email render.
// send: up to 250 recipients in chunks of 50 with one retry each.
export const maxDuration = 60

/**
 * Daily morning newsletter.
 *
 *   GET /api/cron/newsletter?stage=prepare   (06:30 Africa/Lagos = 05:30 UTC)
 *   GET /api/cron/newsletter?stage=send      (07:00 Africa/Lagos = 06:00 UTC)
 *
 * Both accept `dry=1` (no writes, no sends) and `limit=N` (send only).
 * `to=` is deliberately refused here: a single test recipient is an admin
 * action, and the cron secret is a machine credential.
 */
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
  const stage = (params.get("stage") ?? "prepare").toLowerCase()
  const dry = params.get("dry") === "1"
  const now = new Date()

  if (params.get("to")) {
    return NextResponse.json(
      { error: "A single test recipient belongs to the admin endpoint (/api/admin/newsletter/[id])." },
      { status: 400 },
    )
  }

  const limitParam = params.get("limit")
  const parsedLimit = limitParam ? Number.parseInt(limitParam, 10) : null
  const limit = parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : null

  if (stage !== "prepare" && stage !== "send") {
    return NextResponse.json({ error: "stage must be prepare or send" }, { status: 400 })
  }

  const config = newsletterConfig()

  try {
    if (stage === "prepare") {
      const result = await prepareRuntime(now, dry)
      const status = !config.brevoApiKey && !dry ? 503 : 200
      return NextResponse.json(result, { status })
    }

    if (!config.brevoApiKey) {
      return NextResponse.json(
        {
          error: "BREVO_API_KEY is not configured: nothing was sent.",
          stage,
          dry,
          sent: 0,
          failed: 0,
        },
        { status: 503 },
      )
    }

    const result = await sendRuntime({ now, dry, limit })
    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    // Never echo a token, an address or a stack into the response body.
    const message = error instanceof Error ? error.message.slice(0, 300) : "unexpected error"
    return NextResponse.json({ error: message, stage, dry }, { status: 500 })
  }
}

/** Admin convenience: the pause switch, read-only. */
export async function HEAD() {
  const paused = await getSetting("paused").catch(() => null)
  return new NextResponse(null, { status: 200, headers: { "x-newsletter-paused": String(paused === "true") } })
}
