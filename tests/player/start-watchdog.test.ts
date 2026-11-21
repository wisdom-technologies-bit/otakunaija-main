import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_HARD_CAP_MS,
  DEFAULT_MANIFEST_GRACE_MS,
  StartWatchdog,
} from '@/lib/player/start-watchdog'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

function build(overrides: Partial<ConstructorParameters<typeof StartWatchdog>[0]> = {}) {
  const onExpire = vi.fn()
  const watchdog = new StartWatchdog({ onExpire, ...overrides })
  return { watchdog, onExpire }
}

describe('StartWatchdog', () => {
  it('expires with no-fragment when nothing is requested inside the manifest grace period', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    vi.advanceTimersByTime(DEFAULT_MANIFEST_GRACE_MS - 1)
    expect(onExpire).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(onExpire).toHaveBeenCalledWith('no-fragment')
  })

  it('does not expire while a slow start keeps making progress', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.noteManifestLoaded()
    watchdog.noteFragmentLoading()
    // A 3 MB first segment on a weak link: 20 s of steady bytes.
    for (let step = 1; step <= 20; step += 1) {
      vi.advanceTimersByTime(1_000)
      watchdog.noteProgress(step * 150_000)
    }
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('expires with no-progress when bytes stop arriving', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.noteFragmentLoading()
    watchdog.noteProgress(1_000)
    vi.advanceTimersByTime(25_000)
    expect(onExpire).toHaveBeenCalledWith('no-progress')
  })

  it('ignores a progress report that does not move forward', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.noteFragmentLoading()
    watchdog.noteProgress(5_000)
    vi.advanceTimersByTime(20_000)
    // A loader polling the same byte count must not keep a dead transfer alive.
    watchdog.noteProgress(5_000)
    vi.advanceTimersByTime(5_000)
    expect(onExpire).toHaveBeenCalledWith('no-progress')
  })

  it('stops on the hard cap even while bytes keep arriving', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.noteFragmentLoading()
    for (let step = 1; step <= 70; step += 1) {
      vi.advanceTimersByTime(1_000)
      watchdog.noteProgress(step * 1_000)
    }
    expect(onExpire).toHaveBeenCalledWith('hard-cap')
    expect(onExpire).toHaveBeenCalledTimes(1)
    expect(DEFAULT_HARD_CAP_MS).toBe(60_000)
  })

  it('never fires after playback starts', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.noteFragmentLoading()
    watchdog.notePlaying()
    vi.advanceTimersByTime(120_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('never fires after cancel', () => {
    const { watchdog, onExpire } = build()
    watchdog.start()
    watchdog.cancel()
    vi.advanceTimersByTime(120_000)
    expect(onExpire).not.toHaveBeenCalled()
  })

  it('is idempotent: a second start does not rearm the hard cap', () => {
    const { watchdog, onExpire } = build({ hardCapMs: 10_000 })
    watchdog.start()
    vi.advanceTimersByTime(6_000)
    watchdog.start()
    vi.advanceTimersByTime(4_000)
    expect(onExpire).toHaveBeenCalledWith('hard-cap')
  })
})
