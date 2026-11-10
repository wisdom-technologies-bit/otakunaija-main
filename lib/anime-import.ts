/**
 * Admin "Import by AniList ID": parse the input, ask the play service to queue
 * the title, and classify what came back.
 *
 * The play service keeps the queue; this repo only logs the request. Nothing
 * here ever logs PLAY_REQUEST_SECRET — error strings are fixed on purpose.
 */

/** `21`, `anilist.co/anime/21`, `https://anilist.co/anime/21/title` -> 21. */
export function parseAniListId(input: unknown): number | null {
  if (typeof input === 'number' && Number.isInteger(input) && input > 0) return input
  if (typeof input !== 'string') return null

  const trimmed = input.trim()
  if (!trimmed) return null
  if (/^\d+$/.test(trimmed)) {
    const parsed = Number(trimmed)
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null
  }

  const urlMatch = trimmed.match(/anilist\.co\/anime\/(\d+)/i)
  if (urlMatch) return Number(urlMatch[1])

  // A bare id inside any other URL/string, but only when it is the whole number.
  const looseMatch = trimmed.match(/\b(\d{1,9})\b/)
  return looseMatch ? Number(looseMatch[1]) : null
}

export type ImportOutcome = 'placeholder' | 'queued' | 'error'

export type ImportResult = {
  ok: boolean
  status: ImportOutcome
  anilistId: number
  message: string
}

export function playServiceConfig(): { baseUrl: string; secret: string } | null {
  const baseUrl = (process.env.PLAY_API_URL || '').trim().replace(/\/+$/, '')
  const secret = (process.env.PLAY_REQUEST_SECRET || '').trim()
  if (!baseUrl || !secret) return null
  return { baseUrl, secret }
}

/** Classifies the play service's answer. Tolerant of a few plausible shapes. */
export function classifyImportResponse(okHttp: boolean, httpStatus: number, body: unknown): { status: ImportOutcome; message: string } {
  if (!okHttp) return { status: 'error', message: `Play service responded ${httpStatus}` }

  const record = body && typeof body === 'object' ? (body as Record<string, unknown>) : {}
  const rawStatus = typeof record.status === 'string' ? record.status.toLowerCase() : ''
  const placeholderFlag = record.placeholder === true || record.isPlaceholder === true
  const message =
    typeof record.message === 'string' && record.message
      ? record.message
      : typeof record.detail === 'string' && record.detail
        ? record.detail
        : rawStatus || 'Request accepted'

  if (placeholderFlag || rawStatus === 'placeholder' || rawStatus === 'created') {
    return { status: 'placeholder', message }
  }
  if (rawStatus === 'error' || rawStatus === 'failed' || record.ok === false) {
    return { status: 'error', message }
  }
  return { status: 'queued', message }
}
