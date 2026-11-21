/**
 * Buffer stalls, which are not dead providers.
 *
 * A `bufferStalledError` or a `bufferSeekOverHole` means the picture ran out of
 * data: hls.js recovers from both by itself (it re-requests the fragment, and
 * with the fragment budget in `buildHlsConfig()` it retries four times). The
 * player used to treat a fatal one as a provider failure and switch away, which
 * threw away a provider that was about to recover, and it did so on the first
 * report rather than after the stream had actually failed to resume.
 *
 * So a stall is recorded the moment it is seen - code `HLS_BUFFER_STALL`, with
 * the fragment that was in flight, host and path only - and only escalated once
 * it has outlived the same no-progress budget the start watchdog allows. The
 * two budgets are the same constant so they cannot drift apart.
 */

import type { PlayerFailure } from './diagnostics'
import { redactUrl } from './diagnostics'
import { DEFAULT_PROGRESS_GRACE_MS } from './start-watchdog'

/** How long a stall may last before it counts as a real failure. */
export const STALL_GRACE_MS = DEFAULT_PROGRESS_GRACE_MS

/** The two hls.js details that mean "no data in the buffer", not "no provider". */
const STALL_DETAILS = new Set(['bufferStalledError', 'bufferSeekOverHole'])

export function isBufferStall(details: unknown): boolean {
  return typeof details === 'string' && STALL_DETAILS.has(details)
}

/**
 * The `HLS_BUFFER_STALL` report. The fragment URL is redacted to host and path:
 * a proxied segment URL carries its HMAC in the query string.
 */
export function describeBufferStall(input: { fragmentUrl?: string | null; stalledForMs: number }): PlayerFailure & { detail: string } {
  const seconds = Math.max(0, Math.round(input.stalledForMs / 1000))
  const target = redactUrl(input.fragmentUrl)
  return {
    code: 'HLS_BUFFER_STALL',
    message: 'Playback stalled on a video segment',
    retryable: true,
    detail: target ? `stalled ${seconds}s ${target}` : `stalled ${seconds}s`,
  }
}

/** True once the stall has lasted longer than the watchdog's no-progress budget. */
export function shouldEscalateStall(stalledForMs: number): boolean {
  return stalledForMs >= STALL_GRACE_MS
}
