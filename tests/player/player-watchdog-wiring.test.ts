import { readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

/**
 * The start watchdog is only as good as its wiring.
 *
 * `StartWatchdog` itself is covered by start-watchdog.test.ts, and every one of
 * those tests passed while the player was still broken: the class settles on
 * `notePlaying()`, but the hls.js branch of `video-player.tsx` never called it.
 * So the watchdog kept the 60 s hard cap armed for the whole session and killed
 * a healthy stream one minute in, on every browser that has MSE - which is every
 * desktop Chrome, Edge, Firefox and Android device. The native branch (iOS
 * Safari) settled it on `canplay` and was never affected.
 *
 * A unit test cannot see that, so this one reads the component and asserts the
 * wiring. It is deliberately narrow: the hls.js branch must settle the watchdog
 * on the media element's own "playback really started" events.
 */

const PLAYER = path.join(process.cwd(), 'components', 'episodes', 'video-player.tsx')
const source = readFileSync(PLAYER, 'utf8')

/** The hls.js branch: from `new Hls(...)` to the end of the effect. */
function hlsBranch(text: string) {
  const start = text.indexOf('const hls = new Hls(')
  expect(start).toBeGreaterThan(-1)
  const end = text.indexOf("}, [forceHls, handlePlaybackFailure, isPlaying, sourceIsHls, sourceUrl])", start)
  expect(end).toBeGreaterThan(start)
  return text.slice(start, end)
}

describe('hls.js playback settles the start watchdog', () => {
  const branch = hlsBranch(source)

  it('settles the watchdog once the media element is actually playing', () => {
    expect(branch).toMatch(/instance\.notePlaying\(\)/)
    expect(branch).toMatch(/addEventListener\('playing'/)
  })

  it('removes the listener it added, so a re-run cannot leak it', () => {
    expect(branch).toMatch(/removeEventListener\('playing'/)
  })

  it('never reports an impossible byte count as progress', () => {
    // `noteProgress(Number.MAX_SAFE_INTEGER)` poisoned the high-water mark: every
    // later buffered.end() then looked like "no increase" and the grace clock was
    // never re-armed again.
    expect(branch).not.toMatch(/noteProgress\(Number\.MAX_SAFE_INTEGER\)/)
  })
})
