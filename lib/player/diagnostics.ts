/**
 * Player failure codes.
 *
 * The overlay used to say "This episode is currently unavailable" for every
 * possible failure: a provider that has no stream, a CORS rejection, a broken
 * manifest, a 403 on a segment, a slow start. From a phone screenshot those are
 * indistinguishable, so a real diagnosis needed server logs that the viewer
 * cannot produce. Each failure now carries a short stable code, shown under the
 * message and written to `console.warn`, so a screenshot is enough.
 *
 * Nothing here may log a signed URL or a token: `/api/proxy/*` URLs carry an
 * HMAC in `s=` and a base64 target in `u=`. `redactUrl` keeps the host and path
 * and drops the query string.
 */

export type PlayerCode =
  | 'PLAY_RESOLVE_HTTP_404'
  | 'PLAY_RESOLVE_HTTP_5XX'
  | 'PLAY_RESOLVE_HTTP_OTHER'
  | 'PLAY_RESOLVE_NETWORK'
  | 'PLAY_RESOLVE_TIMEOUT'
  | 'PLAY_NO_STREAM_URL'
  | 'HLS_MANIFEST_LOAD_ERROR'
  | 'HLS_FRAG_LOAD_ERROR'
  | 'HLS_FATAL_MEDIA_ERROR'
  | 'HLS_FATAL_OTHER'
  | 'NATIVE_HLS_ERROR'
  | 'PLAYBACK_TIMEOUT'
  | 'SUBTITLE_LOAD_ERROR'
  | 'PLAYER_MODE'
  | 'PLAYER_EXHAUSTED'

/** A failure play answers with when no provider can serve the episode. */
export const DEFINITIVE_RESOLVE_ERRORS = ['EPISODE_NOT_FOUND', 'NO_WORKING_STREAM', 'NO_PROVIDERS_AVAILABLE'] as const

export interface PlayerFailure {
  code: PlayerCode
  /** One short line a viewer can read. */
  message: string
  /** True when trying another provider could plausibly help. */
  retryable: boolean
}

/**
 * Host plus path only. The query string is where signed URLs keep their HMAC,
 * so it never survives. A value that is not a URL is returned trimmed to a
 * conservative length rather than echoed whole.
 */
export function redactUrl(value: unknown): string {
  if (typeof value !== 'string' || !value) return ''
  try {
    const url = new URL(value, 'https://relative.invalid')
    if (url.host === 'relative.invalid') return url.pathname
    return `${url.origin}${url.pathname}`
  } catch {
    return value.slice(0, 80)
  }
}

/** Maps a non-2xx `/api/watch` answer to a code. */
export function describeResolveStatus(status: number, bodyError: string): PlayerFailure {
  const definitive = (DEFINITIVE_RESOLVE_ERRORS as readonly string[]).includes(bodyError)
  if (status === 404) {
    return {
      code: 'PLAY_RESOLVE_HTTP_404',
      message: definitive
        ? 'No working stream for this episode'
        : 'Episode not found on the play service',
      // A 404 with a definitive body is an answer, not a hiccup: another
      // provider cannot fix a missing episode row or a proven dead catalog.
      retryable: !definitive,
    }
  }
  if (status >= 500) {
    return { code: 'PLAY_RESOLVE_HTTP_5XX', message: 'Play service error', retryable: true }
  }
  return { code: 'PLAY_RESOLVE_HTTP_OTHER', message: `Play service responded ${status}`, retryable: false }
}

/**
 * hls.js error data. `data.response.code` is the HTTP status the loader saw,
 * which is the difference between "the manifest is 404" and "the segment was
 * refused" that the old `if (data.fatal)` threw away.
 */
export interface HlsErrorShape {
  type?: string
  details?: string
  fatal?: boolean
  response?: { code?: number; text?: string }
  url?: string
  reason?: string
}

export function describeHlsError(data: HlsErrorShape): PlayerFailure & { detail: string } {
  const details = typeof data.details === 'string' ? data.details : 'unknown'
  const status = data.response?.code
  const detail = `${details}${typeof status === 'number' ? ` http=${status}` : ''}`
  const target = redactUrl(data.url)

  const isManifest = /^manifest/i.test(details) || /^levelLoad/i.test(details)
  if (isManifest) {
    return {
      code: 'HLS_MANIFEST_LOAD_ERROR',
      message: typeof status === 'number' && status >= 400 ? `Stream manifest refused (${status})` : 'Could not load the stream manifest',
      // A 403/404 manifest will not fix itself on the same provider.
      retryable: typeof status !== 'number' || status >= 500 || status === 0,
      detail: target ? `${detail} ${target}` : detail,
    }
  }
  if (/^fragLoad|^fragParsing|^fragDecrypt/i.test(details)) {
    return {
      code: 'HLS_FRAG_LOAD_ERROR',
      message: typeof status === 'number' && status >= 400 ? `Video segment refused (${status})` : 'Video segment failed to load',
      retryable: typeof status !== 'number' || status >= 500 || status === 0 || status === 403,
      detail: target ? `${detail} ${target}` : detail,
    }
  }
  if (/mediaError/i.test(String(data.type ?? ''))) {
    return { code: 'HLS_FATAL_MEDIA_ERROR', message: 'This stream could not be decoded', retryable: true, detail }
  }
  return { code: 'HLS_FATAL_OTHER', message: 'Playback failed', retryable: true, detail: target ? `${detail} ${target}` : detail }
}

/** `video.error` on the native path, which the player previously ignored. */
export function describeMediaError(error: { code?: number; message?: string } | null | undefined): PlayerFailure & { detail: string } {
  const code = typeof error?.code === 'number' ? error.code : 0
  const names: Record<number, string> = {
    1: 'aborted',
    2: 'network',
    3: 'decode',
    4: 'src-not-supported',
  }
  return {
    code: 'NATIVE_HLS_ERROR',
    message: code === 4 ? 'This browser cannot play the stream natively' : 'The stream stopped while loading',
    retryable: true,
    detail: `${names[code] ?? 'unknown'}${error?.message ? ` ${String(error.message).slice(0, 60)}` : ''}`,
  }
}

export function describeTimeout(reason: 'no-fragment' | 'no-progress' | 'hard-cap'): PlayerFailure & { detail: string } {
  return {
    code: 'PLAYBACK_TIMEOUT',
    message: 'The stream is taking too long to start',
    retryable: true,
    detail: reason,
  }
}

/** Short human line for the overlay. Never includes a URL. */
export function overlayMessage(failure: PlayerFailure): string {
  return failure.message
}

// ---------------------------------------------------------------------------
// Ring buffer for `?debug=1`
// ---------------------------------------------------------------------------

export interface PlayerEvent {
  at: number
  code: string
  detail: string
}

const MAX_EVENTS = 5
const buffer: PlayerEvent[] = []
const listeners = new Set<(events: PlayerEvent[]) => void>()

/** Keeps the last 5 events for the on-screen panel. No secrets, no URLs. */
export function recordPlayerEvent(code: string, detail = ''): PlayerEvent {
  const event = { at: Date.now(), code, detail: detail.slice(0, 160) }
  buffer.push(event)
  while (buffer.length > MAX_EVENTS) buffer.shift()
  for (const listener of listeners) listener([...buffer])
  return event
}

export function recentPlayerEvents(): PlayerEvent[] {
  return [...buffer]
}

export function subscribePlayerEvents(listener: (events: PlayerEvent[]) => void): () => void {
  listeners.add(listener)
  listener([...buffer])
  return () => {
    listeners.delete(listener)
  }
}

/** Clears the buffer when a new episode mounts, so the panel is per-episode. */
export function resetPlayerEvents() {
  buffer.length = 0
  for (const listener of listeners) listener([])
}

/**
 * One line to `console.warn`, always prefixed so a screenshot of a remote
 * debugging console is enough to identify the failure.
 */
export function logPlayerEvent(code: string, detail = '') {
  recordPlayerEvent(code, detail)
  console.warn(`[player] ${code}${detail ? ` ${detail}` : ''}`)
}
