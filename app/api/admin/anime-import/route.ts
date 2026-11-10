import { NextResponse } from 'next/server'
import { desc } from 'drizzle-orm'
import { getCurrentSession } from '@/lib/auth'
import { db } from '@/lib/db/index'
import { animeImportLog } from '@/lib/db/schema'
import { classifyImportResponse, parseAniListId, playServiceConfig } from '@/lib/anime-import'

const REQUEST_TIMEOUT_MS = 15_000

/** Last 20 imports, newest first. */
export async function GET() {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const rows = await db
      .select()
      .from(animeImportLog)
      .orderBy(desc(animeImportLog.createdAt))
      .limit(20)
    return NextResponse.json({ requests: rows })
  } catch (error) {
    console.error('[admin/anime-import] log read failed', error)
    return NextResponse.json({ error: 'LOG_UNAVAILABLE', requests: [] }, { status: 500 })
  }
}

/**
 * Queues an AniList title through the play service.
 *
 *   POST /api/admin/anime-import  { "anilistId": 21 }
 *
 * The play service creates an upcoming placeholder (or queues a full sync);
 * `PLAY_API_URL` + `PLAY_REQUEST_SECRET` must be set. The secret is only ever
 * sent as a header and never appears in a response or a log line.
 */
export async function POST(request: Request) {
  const session = await getCurrentSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'INVALID_BODY' }, { status: 400 })
  }

  const raw = body && typeof body === 'object' ? (body as Record<string, unknown>).anilistId ?? (body as Record<string, unknown>).input : null
  const anilistId = parseAniListId(raw)
  if (!anilistId) {
    return NextResponse.json(
      { error: 'INVALID_ANILIST_ID', message: 'Enter an AniList id or an anilist.co/anime/… link.' },
      { status: 400 },
    )
  }

  const config = playServiceConfig()
  if (!config) {
    const message = 'Import is not configured: set PLAY_API_URL and PLAY_REQUEST_SECRET.'
    await logImport(anilistId, session.email, 'error', message)
    return NextResponse.json({ error: 'NOT_CONFIGURED', message }, { status: 503 })
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

  try {
    const response = await fetch(`${config.baseUrl}/api/discovery/request`, {
      method: 'POST',
      cache: 'no-store',
      signal: controller.signal,
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-play-request-secret': config.secret,
        authorization: `Bearer ${config.secret}`,
      },
      body: JSON.stringify({ anilistId }),
    })

    let payload: unknown = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }

    const outcome = classifyImportResponse(response.ok, response.status, payload)
    await logImport(anilistId, session.email, outcome.status, outcome.message)

    return NextResponse.json(
      { anilistId, status: outcome.status, message: outcome.message },
      { status: outcome.status === 'error' ? 502 : 200 },
    )
  } catch (error) {
    // Fixed message: a raw error can quote the URL. Never include the secret.
    const aborted = error instanceof Error && (error.name === 'AbortError' || error.name === 'TimeoutError')
    const message = aborted ? 'Play service timed out' : 'Play service could not be reached'
    await logImport(anilistId, session.email, 'error', message)
    return NextResponse.json({ error: 'PLAY_UNAVAILABLE', message }, { status: 502 })
  } finally {
    clearTimeout(timer)
  }
}

async function logImport(anilistId: number, email: string | null, status: 'placeholder' | 'queued' | 'error', message: string) {
  try {
    await db.insert(animeImportLog).values({
      anilistId,
      requestedBy: email ?? null,
      status,
      message: message.slice(0, 500),
    })
  } catch (error) {
    console.error('[admin/anime-import] log write failed', error)
  }
}
