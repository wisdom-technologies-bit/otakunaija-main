import { describe, expect, it } from 'vitest'

import {
  buildHlsConfig,
  choosePlaybackMode,
  classifyUserAgent,
} from '@/lib/player/playback-strategy'

/**
 * The measured values that motivated this module. Chromium 159 (headless,
 * Linux) answers "maybe" for the HLS MIME type on every user-agent profile,
 * including a Pixel 7 one, so `canPlayType(...) !== ''` was true on desktop
 * Chrome as well and hls.js was never reached.
 */
const CHROMIUM_159_CANPLAY = 'maybe'

describe('choosePlaybackMode', () => {
  it('prefers hls.js whenever MSE is available, even when the browser claims native HLS', () => {
    const decision = choosePlaybackMode({
      nativeHlsSupport: CHROMIUM_159_CANPLAY,
      hlsJsSupported: true,
      userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 7) Chrome/159 Mobile Safari/537.36',
    })
    expect(decision.mode).toBe('hlsjs')
    expect(decision.reason).toBe('mse-available')
    expect(decision.userAgentClass).toBe('android')
  })

  it('prefers hls.js on desktop Chrome, where canPlayType also says "maybe"', () => {
    const decision = choosePlaybackMode({
      nativeHlsSupport: CHROMIUM_159_CANPLAY,
      hlsJsSupported: true,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) Chrome/159 Safari/537.36',
    })
    expect(decision.mode).toBe('hlsjs')
    expect(decision.userAgentClass).toBe('desktop')
  })

  it('uses the native player only when there is no MSE (iOS Safari)', () => {
    const decision = choosePlaybackMode({
      nativeHlsSupport: 'maybe',
      hlsJsSupported: false,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Version/17.0 Mobile/15E148 Safari/604.1',
    })
    expect(decision.mode).toBe('native')
    expect(decision.reason).toBe('native-hls-no-mse')
    expect(decision.userAgentClass).toBe('ios')
  })

  it('falls back when there is neither MSE nor a native claim', () => {
    const decision = choosePlaybackMode({ nativeHlsSupport: '', hlsJsSupported: false, userAgent: '' })
    expect(decision.mode).toBe('fallback')
    expect(decision.reason).toBe('no-hls-support')
    expect(decision.userAgentClass).toBe('unknown')
  })

  it('never returns native when MSE exists, whatever the canPlayType answer', () => {
    for (const nativeHlsSupport of ['', 'maybe', 'probably']) {
      expect(choosePlaybackMode({ nativeHlsSupport, hlsJsSupported: true }).mode).toBe('hlsjs')
    }
  })
})

describe('classifyUserAgent', () => {
  it('separates the three classes the player reports', () => {
    expect(classifyUserAgent('Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)')).toBe('ios')
    expect(classifyUserAgent('Mozilla/5.0 (Linux; Android 14; SM-S918B)')).toBe('android')
    expect(classifyUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
    expect(classifyUserAgent('curl/8.0')).toBe('unknown')
    expect(classifyUserAgent()).toBe('unknown')
  })
})

describe('buildHlsConfig', () => {
  it('starts on a low level and caps the level to the rendered size', () => {
    const config = buildHlsConfig()
    expect(config.startLevel).toBe(-1)
    expect(config.abrEwmaDefaultEstimate).toBeLessThanOrEqual(1_000_000)
    expect(config.capLevelToPlayerSize).toBe(true)
  })

  it('keeps the manifest budget but fails a stalled fragment quickly', () => {
    const config = buildHlsConfig()
    // A cold provider resolve plus a proxied manifest can still take 20 s.
    expect(config.manifestLoadingTimeOut).toBe(20_000)
    expect(config.manifestLoadingMaxRetry).toBe(2)
    expect(config.levelLoadingTimeOut).toBe(15_000)
    // A fragment that never arrives must not hold the picture for 30 s.
    expect(config.fragLoadingTimeOut).toBe(15_000)
    expect(config.fragLoadingMaxRetry).toBe(4)
    expect(config.fragLoadingRetryDelay).toBeGreaterThanOrEqual(500)
    expect(config.fragLoadingRetryDelay).toBeLessThanOrEqual(1_000)
  })
})
