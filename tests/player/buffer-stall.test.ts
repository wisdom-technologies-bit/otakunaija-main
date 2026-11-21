import { describe, expect, it } from 'vitest'

import { STALL_GRACE_MS, describeBufferStall, isBufferStall, shouldEscalateStall } from '@/lib/player/buffer-stall'
import { DEFAULT_PROGRESS_GRACE_MS } from '@/lib/player/start-watchdog'

/**
 * A stalled buffer is what the viewer sees as a frozen picture. hls.js recovers
 * from `bufferStalledError` and `bufferSeekOverHole` on its own, so the player
 * must not switch provider on the first report: it records HLS_BUFFER_STALL with
 * the fragment that was in flight, and only escalates once the stall has
 * outlived the watchdog's no-progress budget.
 */

describe('isBufferStall', () => {
  it('recognises the two hls.js details that mean "no data in the buffer"', () => {
    expect(isBufferStall('bufferStalledError')).toBe(true)
    expect(isBufferStall('bufferSeekOverHole')).toBe(true)
  })

  it('leaves a fragment load error and an unknown detail alone', () => {
    expect(isBufferStall('fragLoadError')).toBe(false)
    expect(isBufferStall('bufferAppendError')).toBe(false)
    expect(isBufferStall(undefined)).toBe(false)
    expect(isBufferStall(42)).toBe(false)
  })
})

describe('describeBufferStall', () => {
  it('reports HLS_BUFFER_STALL with the fragment host and path only', () => {
    const failure = describeBufferStall({
      fragmentUrl: 'https://seg1.mistyhorizon.space/anikoto/seg-f3-00001.html?u=aHR0cHM6&h=eyJS&e=1795&s=deadbeef',
      stalledForMs: 26_000,
    })

    expect(failure.code).toBe('HLS_BUFFER_STALL')
    expect(failure.retryable).toBe(true)
    expect(failure.detail).toContain('seg1.mistyhorizon.space/anikoto/seg-f3-00001.html')
    // The signed query string never reaches the panel or the console.
    expect(failure.detail).not.toContain('u=')
    expect(failure.detail).not.toContain('s=')
    expect(failure.detail).not.toContain('?')
    expect(failure.detail).toContain('stalled 26s')
  })

  it('records a fresh stall as 0s, which is what the panel shows first', () => {
    const failure = describeBufferStall({ fragmentUrl: null, stalledForMs: 0 })
    expect(failure.detail).toBe('stalled 0s')
  })

  it('omits the URL when nothing was in flight', () => {
    expect(describeBufferStall({ fragmentUrl: null, stalledForMs: 3_000 }).detail).toBe('stalled 3s')
  })
})

describe('shouldEscalateStall', () => {
  it('uses the watchdog no-progress budget, so the two cannot drift', () => {
    expect(STALL_GRACE_MS).toBe(DEFAULT_PROGRESS_GRACE_MS)
  })

  it('does not escalate a stall the watchdog would still allow', () => {
    expect(shouldEscalateStall(0)).toBe(false)
    expect(shouldEscalateStall(STALL_GRACE_MS - 1)).toBe(false)
    expect(shouldEscalateStall(STALL_GRACE_MS)).toBe(true)
  })
})
