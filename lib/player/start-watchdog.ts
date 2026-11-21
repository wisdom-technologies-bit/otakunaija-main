/**
 * The "has playback started?" watchdog.
 *
 * The player used to arm a single 12 s timer the moment a source URL existed and
 * give up if `video.readyState <= 1` when it fired. That is a fixed budget for a
 * variable job: a cold provider resolve, a proxied manifest, a variant playlist
 * and a multi-megabyte first segment can legitimately take longer on a weak
 * mobile connection, and a slow-but-progressing load was treated exactly like a
 * dead provider. The player then excluded a provider that was working.
 *
 * This watchdog replaces the fixed deadline with three clocks:
 *
 *  - a manifest grace period, for the time before the first fragment is even
 *    requested (hls.js still fetching the manifest and its variants);
 *  - a progress grace period, armed when the first fragment request starts and
 *    re-armed every time bytes arrive, so a slow download keeps itself alive;
 *  - a hard cap that is never extended, so the overlay can never say
 *    "Switching provider..." forever.
 *
 * All three report a distinct reason, which the player turns into a
 * `PLAYBACK_TIMEOUT` code plus the reason in the log.
 */

export type WatchdogExpiryReason = 'no-fragment' | 'no-progress' | 'hard-cap'

export interface StartWatchdogOptions {
  onExpire: (reason: WatchdogExpiryReason) => void
  /** Time allowed before the first fragment request. */
  manifestGraceMs?: number
  /** Time allowed with no new bytes, once a fragment request has started. */
  progressGraceMs?: number
  /** Absolute ceiling, never extended. */
  hardCapMs?: number
}

export const DEFAULT_MANIFEST_GRACE_MS = 25_000
export const DEFAULT_PROGRESS_GRACE_MS = 25_000
export const DEFAULT_HARD_CAP_MS = 60_000

export class StartWatchdog {
  private readonly onExpire: (reason: WatchdogExpiryReason) => void
  private readonly manifestGraceMs: number
  private readonly progressGraceMs: number
  private readonly hardCapMs: number
  private graceTimer: ReturnType<typeof setTimeout> | null = null
  private hardTimer: ReturnType<typeof setTimeout> | null = null
  private started = false
  private settled = false
  private sawFragment = false
  private lastBytes = 0

  constructor(options: StartWatchdogOptions) {
    this.onExpire = options.onExpire
    this.manifestGraceMs = options.manifestGraceMs ?? DEFAULT_MANIFEST_GRACE_MS
    this.progressGraceMs = options.progressGraceMs ?? DEFAULT_PROGRESS_GRACE_MS
    this.hardCapMs = options.hardCapMs ?? DEFAULT_HARD_CAP_MS
  }

  /** Arms both the grace clock and the hard cap. Idempotent. */
  start() {
    if (this.started || this.settled) return
    this.started = true
    this.hardTimer = setTimeout(() => this.expire('hard-cap'), this.hardCapMs)
    this.armGrace(this.manifestGraceMs, 'no-fragment')
  }

  /** hls.js parsed the manifest. The grace clock keeps running: fragments have not started. */
  noteManifestLoaded() {
    if (!this.started || this.settled || this.sawFragment) return
    this.armGrace(this.manifestGraceMs, 'no-fragment')
  }

  /** The first fragment request was issued: switch to the progress clock. */
  noteFragmentLoading() {
    if (!this.started || this.settled) return
    this.sawFragment = true
    this.armGrace(this.progressGraceMs, 'no-progress')
  }

  /**
   * Bytes arrived. Only a real increase re-arms the clock, so a loader that
   * polls without progress cannot keep a dead transfer alive forever.
   */
  noteProgress(loadedBytes: number) {
    if (!this.started || this.settled) return
    if (!Number.isFinite(loadedBytes) || loadedBytes <= this.lastBytes) return
    this.lastBytes = loadedBytes
    if (this.sawFragment) this.armGrace(this.progressGraceMs, 'no-progress')
  }

  /** Playback is real: stop both clocks. */
  notePlaying() {
    this.settled = true
    this.clear()
  }

  /** Tear down without firing. */
  cancel() {
    this.settled = true
    this.clear()
  }

  private armGrace(ms: number, reason: WatchdogExpiryReason) {
    if (this.graceTimer) clearTimeout(this.graceTimer)
    this.graceTimer = setTimeout(() => this.expire(reason), ms)
  }

  private expire(reason: WatchdogExpiryReason) {
    if (this.settled) return
    this.settled = true
    this.clear()
    this.onExpire(reason)
  }

  private clear() {
    if (this.graceTimer) clearTimeout(this.graceTimer)
    if (this.hardTimer) clearTimeout(this.hardTimer)
    this.graceTimer = null
    this.hardTimer = null
  }
}
