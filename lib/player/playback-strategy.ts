/**
 * Which playback path the episode player should take.
 *
 * The old code asked one question:
 *
 *     video.canPlayType('application/vnd.apple.mpegurl') !== ''
 *
 * and treated a non-empty answer as "this browser plays HLS natively". That is
 * not what `canPlayType` means. It returns `"maybe"` when the browser is willing
 * to *try* the type, which is a promise about the container, not about the
 * demuxer behind it. Measured in Chromium 159 (headless, Linux, and the same
 * binary under a Pixel 7 / iPhone 14 user agent) the answer for that exact
 * string is `"maybe"` on every profile, so the old check routed desktop Chrome
 * down a native path it was never meant to take, and hls.js was never used.
 *
 * The only reliable signal that a browser can actually demux HLS in JavaScript
 * is Media Source Extensions, which is exactly what `Hls.isSupported()` reports.
 * So: prefer hls.js whenever MSE is available, and keep the native `<video src>`
 * path for the one platform that has no MSE and does have a real HLS player,
 * iOS Safari. `fallback` means neither is available and the caller should show
 * a plain <source> and let the browser do whatever it can.
 */

export type PlaybackMode = 'hlsjs' | 'native' | 'fallback'

export type UserAgentClass = 'ios' | 'android' | 'desktop' | 'unknown'

export interface PlaybackStrategyInput {
  /** `video.canPlayType('application/vnd.apple.mpegurl')`: '', 'maybe' or 'probably'. */
  nativeHlsSupport: string
  /** `Hls.isSupported()`: true when Media Source Extensions are usable. */
  hlsJsSupported: boolean
  /** `navigator.userAgent`, used for diagnostics only. */
  userAgent?: string
}

export interface PlaybackDecision {
  mode: PlaybackMode
  /** Stable, loggable reason. Never contains a URL. */
  reason: string
  userAgentClass: UserAgentClass
}

export function classifyUserAgent(userAgent = ''): UserAgentClass {
  const ua = userAgent.toLowerCase()
  if (!ua) return 'unknown'
  // iPadOS 13+ reports a desktop Safari UA, so a touch-capable "Mac" is an iPad.
  if (/iphone|ipad|ipod/.test(ua)) return 'ios'
  if (/android/.test(ua)) return 'android'
  if (/macintosh|windows nt|linux|x11|cros/.test(ua)) return 'desktop'
  return 'unknown'
}

/**
 * MSE wins over a native HLS claim. A native claim is only trusted when there is
 * no MSE to fall back on, which in practice means iOS Safari.
 */
export function choosePlaybackMode(input: PlaybackStrategyInput): PlaybackDecision {
  const userAgentClass = classifyUserAgent(input.userAgent)
  if (input.hlsJsSupported) {
    return { mode: 'hlsjs', reason: 'mse-available', userAgentClass }
  }
  if (input.nativeHlsSupport !== '') {
    return { mode: 'native', reason: 'native-hls-no-mse', userAgentClass }
  }
  return { mode: 'fallback', reason: 'no-hls-support', userAgentClass }
}

/** The hls.js config used for every HLS playback. Kept pure so it can be asserted. */
export interface HlsConfigInput {
  /** Width the player is actually rendered at, when known. */
  playerWidth?: number
}

/**
 * Mobile-first HLS settings.
 *
 * `startLevel: -1` lets ABR choose the first level, and
 * `abrEwmaDefaultEstimate` seeds that choice low (~480p, 800 kbit/s) so the
 * first fragment is small and the picture starts instead of stalling on a
 * multi-megabyte 1080p segment. `capLevelToPlayerSize` stops a phone from being
 * handed a level its viewport cannot show. The loader timeouts are deliberately
 * generous: a cold provider resolve plus a proxied manifest can take longer than
 * hls.js's 10 s default, and a timeout there looks identical to a dead provider.
 */
export function buildHlsConfig(input: HlsConfigInput = {}) {
  return {
    startLevel: -1,
    abrEwmaDefaultEstimate: 800_000,
    capLevelToPlayerSize: true,
    maxBufferLength: 30,
    maxMaxBufferLength: 60,
    manifestLoadingTimeOut: 20_000,
    manifestLoadingMaxRetry: 2,
    levelLoadingTimeOut: 20_000,
    levelLoadingMaxRetry: 3,
    fragLoadingTimeOut: 30_000,
    fragLoadingMaxRetry: 4,
    ...(typeof input.playerWidth === 'number' && input.playerWidth > 0
      ? { capLevelToPlayerSize: true }
      : {}),
  }
}
