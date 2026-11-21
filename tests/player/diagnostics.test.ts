import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  describeHlsError,
  describeMediaError,
  describeResolveStatus,
  describeTimeout,
  logPlayerEvent,
  recentPlayerEvents,
  recordPlayerEvent,
  redactUrl,
  resetPlayerEvents,
} from '@/lib/player/diagnostics'

beforeEach(() => resetPlayerEvents())

describe('redactUrl', () => {
  it('keeps host and path and drops the signed query string', () => {
    const signed = 'https://play.otakunaija.name.ng/api/proxy/manifest?u=aHR0cHM6&h=eyJS&e=1795&s=deadbeef'
    expect(redactUrl(signed)).toBe('https://play.otakunaija.name.ng/api/proxy/manifest')
  })

  it('handles a relative signed path', () => {
    expect(redactUrl('/api/proxy/segment?u=x&s=y')).toBe('/api/proxy/segment')
  })

  it('returns an empty string for a non-string', () => {
    expect(redactUrl(undefined)).toBe('')
    expect(redactUrl(42)).toBe('')
  })
})

describe('describeResolveStatus', () => {
  it('marks a 404 EPISODE_NOT_FOUND as a definitive, non-retryable answer', () => {
    const failure = describeResolveStatus(404, 'EPISODE_NOT_FOUND')
    expect(failure.code).toBe('PLAY_RESOLVE_HTTP_404')
    expect(failure.retryable).toBe(false)
  })

  it('marks a 404 NO_WORKING_STREAM as definitive too', () => {
    expect(describeResolveStatus(404, 'NO_WORKING_STREAM')).toMatchObject({
      code: 'PLAY_RESOLVE_HTTP_404',
      retryable: false,
    })
  })

  it('treats a 5xx as retryable', () => {
    const failure = describeResolveStatus(502, '')
    expect(failure.code).toBe('PLAY_RESOLVE_HTTP_5XX')
    expect(failure.retryable).toBe(true)
  })

  it('gives any other status its own non-retryable code', () => {
    expect(describeResolveStatus(403, '')).toMatchObject({ code: 'PLAY_RESOLVE_HTTP_OTHER', retryable: false })
  })
})

describe('describeHlsError', () => {
  it('separates a manifest failure from a fragment failure', () => {
    expect(describeHlsError({ type: 'networkError', details: 'manifestLoadError', fatal: true, response: { code: 0 } }))
      .toMatchObject({ code: 'HLS_MANIFEST_LOAD_ERROR' })
    expect(describeHlsError({ type: 'networkError', details: 'fragLoadError', fatal: true, response: { code: 403 } }))
      .toMatchObject({ code: 'HLS_FRAG_LOAD_ERROR' })
  })

  it('carries the HTTP status in the detail', () => {
    const failure = describeHlsError({ type: 'networkError', details: 'fragLoadError', fatal: true, response: { code: 403 } })
    expect(failure.detail).toContain('http=403')
  })

  it('does not retry a definitive 404 manifest', () => {
    expect(describeHlsError({ details: 'manifestLoadError', response: { code: 404 } }).retryable).toBe(false)
  })

  it('retries a 403 fragment, which is the intermittent CDN case', () => {
    expect(describeHlsError({ details: 'fragLoadError', response: { code: 403 } }).retryable).toBe(true)
  })

  it('maps a media error to its own code', () => {
    expect(describeHlsError({ type: 'mediaError', details: 'bufferAppendError', fatal: true }))
      .toMatchObject({ code: 'HLS_FATAL_MEDIA_ERROR' })
  })

  it('falls back to HLS_FATAL_OTHER and never logs a signed url', () => {
    const failure = describeHlsError({
      type: 'otherError',
      details: 'somethingElse',
      fatal: true,
      url: 'https://play.otakunaija.name.ng/api/proxy/segment?u=abc&s=secret',
    })
    expect(failure.code).toBe('HLS_FATAL_OTHER')
    expect(failure.detail).not.toContain('secret')
    expect(failure.detail).toContain('/api/proxy/segment')
  })
})

describe('describeMediaError', () => {
  it('names the native media error codes', () => {
    expect(describeMediaError({ code: 4 }).code).toBe('NATIVE_HLS_ERROR')
    expect(describeMediaError({ code: 4 }).detail).toBe('src-not-supported')
    expect(describeMediaError({ code: 3 }).detail).toBe('decode')
    expect(describeMediaError(null).detail).toBe('unknown')
  })
})

describe('describeTimeout', () => {
  it('keeps the watchdog reason in the detail', () => {
    expect(describeTimeout('no-fragment')).toMatchObject({ code: 'PLAYBACK_TIMEOUT', detail: 'no-fragment' })
  })
})

describe('the event ring buffer', () => {
  it('keeps only the last five events', () => {
    for (let index = 0; index < 8; index += 1) recordPlayerEvent(`E${index}`)
    const events = recentPlayerEvents()
    expect(events).toHaveLength(5)
    expect(events.map((event) => event.code)).toEqual(['E3', 'E4', 'E5', 'E6', 'E7'])
  })

  it('truncates a long detail so the panel cannot overflow', () => {
    recordPlayerEvent('PLAY_RESOLVE_OK', 'x'.repeat(500))
    expect(recentPlayerEvents()[0].detail.length).toBe(160)
  })

  it('records through the console.warn helper', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    logPlayerEvent('PLAY_RESOLVE_HTTP_404', 'playId=21-1180 status=404')
    expect(warn).toHaveBeenCalledWith('[player] PLAY_RESOLVE_HTTP_404 playId=21-1180 status=404')
    expect(recentPlayerEvents()[0].code).toBe('PLAY_RESOLVE_HTTP_404')
    warn.mockRestore()
  })
})
