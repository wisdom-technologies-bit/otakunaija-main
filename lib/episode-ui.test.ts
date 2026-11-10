import { describe, expect, it } from 'vitest'
import {
  EPISODE_RANGE_SIZE,
  countdownParts,
  countdownTiles,
  episodeCountLabel,
  episodeInRange,
  episodeRanges,
  formatCountdown,
  highestEpisodeNumber,
  isNewEpisode,
  logoState,
  rangeIndexForEpisode,
  safeLogoAspect,
  safeLogoWidth,
  selectRelatedSeries,
  trailerTarget,
} from './episode-ui'

describe('episodeRanges', () => {
  it('returns one window for a short series', () => {
    expect(episodeRanges(12)).toEqual([{ index: 0, start: 1, end: 12, label: '1 – 12' }])
  })

  it('splits 120 episodes into 1–50, 51–100, 101–120', () => {
    expect(episodeRanges(120)).toEqual([
      { index: 0, start: 1, end: 50, label: '1 – 50' },
      { index: 1, start: 51, end: 100, label: '51 – 100' },
      { index: 2, start: 101, end: 120, label: '101 – 120' },
    ])
  })

  it('labels a single-episode window without a dash', () => {
    expect(episodeRanges(1)).toEqual([{ index: 0, start: 1, end: 1, label: 'Ep 1' }])
  })

  it('is empty for zero, negative or junk input', () => {
    expect(episodeRanges(0)).toEqual([])
    expect(episodeRanges(-4)).toEqual([])
    expect(episodeRanges(Number.NaN)).toEqual([])
  })

  it('honours a custom window size', () => {
    expect(episodeRanges(25, 10).map((r) => r.label)).toEqual(['1 – 10', '11 – 20', '21 – 25'])
    expect(EPISODE_RANGE_SIZE).toBe(50)
  })
})

describe('rangeIndexForEpisode / episodeInRange', () => {
  it('maps an episode to its window', () => {
    expect(rangeIndexForEpisode(1)).toBe(0)
    expect(rangeIndexForEpisode(50)).toBe(0)
    expect(rangeIndexForEpisode(51)).toBe(1)
    expect(rangeIndexForEpisode(120)).toBe(2)
  })

  it('clamps nonsense to the first window', () => {
    expect(rangeIndexForEpisode(0)).toBe(0)
    expect(rangeIndexForEpisode(-3)).toBe(0)
  })

  it('tests membership inclusively and rejects a missing range', () => {
    const range = episodeRanges(120)[1]
    expect(episodeInRange(51, range)).toBe(true)
    expect(episodeInRange(100, range)).toBe(true)
    expect(episodeInRange(101, range)).toBe(false)
    expect(episodeInRange(50, null)).toBe(false)
  })
})

describe('isNewEpisode', () => {
  const now = new Date('2026-11-10T12:00:00Z').getTime()

  it('flags an episode published an hour ago', () => {
    expect(isNewEpisode(new Date(now - 60 * 60 * 1000), now)).toBe(true)
  })

  it('drops the flag at exactly 72 hours', () => {
    expect(isNewEpisode(new Date(now - 71.5 * 60 * 60 * 1000), now)).toBe(true)
    expect(isNewEpisode(new Date(now - 72 * 60 * 60 * 1000), now)).toBe(false)
  })

  it('never flags a future or unparseable date', () => {
    expect(isNewEpisode(new Date(now + 60_000), now)).toBe(false)
    expect(isNewEpisode('not a date', now)).toBe(false)
    expect(isNewEpisode(null, now)).toBe(false)
  })
})

describe('highestEpisodeNumber', () => {
  it('finds the maximum across gaps', () => {
    expect(highestEpisodeNumber([{ episodeNumber: 3 }, { episodeNumber: 11 }, { episodeNumber: 7 }])).toBe(11)
  })

  it('is 0 for empty or missing input', () => {
    expect(highestEpisodeNumber([])).toBe(0)
    expect(highestEpisodeNumber(null)).toBe(0)
    expect(highestEpisodeNumber([{ episodeNumber: null }])).toBe(0)
  })
})

describe('countdown', () => {
  const now = new Date('2026-11-10T00:00:00Z').getTime()

  it('splits a future instant into parts', () => {
    const parts = countdownParts(new Date(now + (2 * 86400 + 4 * 3600 + 9 * 60 + 51) * 1000), now)
    expect(parts).toMatchObject({ days: 2, hours: 4, minutes: 9, seconds: 51, expired: false })
  })

  it('formats days, then hours, then seconds', () => {
    expect(formatCountdown({ days: 12, hours: 4, minutes: 9, seconds: 51, totalSeconds: 1, expired: false })).toBe('12d 04h 09m')
    expect(formatCountdown({ days: 0, hours: 3, minutes: 9, seconds: 51, totalSeconds: 1, expired: false })).toBe('03h 09m 51s')
    expect(formatCountdown({ days: 0, hours: 0, minutes: 9, seconds: 5, totalSeconds: 1, expired: false })).toBe('09m 05s')
  })

  it('clamps a past date to zero and says so', () => {
    const parts = countdownParts(new Date(now - 5000), now)
    expect(parts?.expired).toBe(true)
    expect(parts?.totalSeconds).toBe(0)
    expect(formatCountdown(parts)).toBe('Releasing now')
  })

  it('answers TBA for a missing or invalid date', () => {
    expect(countdownParts(null, now)).toBeNull()
    expect(countdownParts('nope', now)).toBeNull()
    expect(formatCountdown(null)).toBe('Release date TBA')
  })

  it('shows three tiles under a day and four above', () => {
    expect(countdownTiles(countdownParts(new Date(now + 3 * 3600 * 1000), now))).toHaveLength(3)
    expect(countdownTiles(countdownParts(new Date(now + 3 * 86400 * 1000), now))).toHaveLength(4)
    expect(countdownTiles(countdownParts(new Date(now - 1000), now))).toEqual([])
  })
})

describe('logo fallback selection', () => {
  it('uses the logo when a URL exists', () => {
    expect(logoState({ url: 'https://image.tmdb.org/t/p/w500/a.png' })).toBe('logo')
    expect(logoState('https://image.tmdb.org/t/p/w500/a.png')).toBe('logo')
  })

  it('falls back to text for missing, empty or broken logos', () => {
    expect(logoState(null)).toBe('text')
    expect(logoState(undefined)).toBe('text')
    expect(logoState({ url: '' })).toBe('text')
    expect(logoState({ url: '   ' })).toBe('text')
    expect(logoState({ url: 'https://image.tmdb.org/t/p/w500/a.png' }, true)).toBe('text')
  })

  it('sanitises aspect and width', () => {
    expect(safeLogoAspect(2.5)).toBe(2.5)
    expect(safeLogoAspect('4')).toBe(4)
    expect(safeLogoAspect(0)).toBe(3)
    expect(safeLogoAspect('x')).toBe(3)
    expect(safeLogoWidth(1280)).toBe(1280)
    expect(safeLogoWidth(0)).toBe(1000)
  })
})

describe('trailerTarget', () => {
  it('embeds YouTube through youtube-nocookie only', () => {
    expect(trailerTarget('youtube', 'dQw4w9WgXcQ')).toEqual({
      kind: 'embed',
      provider: 'youtube',
      url: 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    })
  })

  it('links out to Dailymotion', () => {
    expect(trailerTarget('dailymotion', 'x8abcde')).toEqual({
      kind: 'link',
      provider: 'dailymotion',
      url: 'https://www.dailymotion.com/video/x8abcde',
    })
  })

  it('refuses unknown providers and junk ids', () => {
    expect(trailerTarget('vimeo', '12345')).toBeNull()
    expect(trailerTarget('youtube', 'has spaces')).toBeNull()
    expect(trailerTarget('youtube', '')).toBeNull()
    expect(trailerTarget(null, 'abc')).toBeNull()
    expect(trailerTarget('youtube', null)).toBeNull()
  })
})

describe('selectRelatedSeries', () => {
  const self = { slug: 'self', genre: 'Action, Fantasy' }
  const candidates = [
    { slug: 'no-genre-match', genre: 'Romance', title: 'B' },
    { slug: 'one-match', genre: 'Action, Comedy', title: 'C' },
    { slug: 'two-match', genre: 'fantasy, Action', title: 'A' },
    { slug: 'self', genre: 'Action, Fantasy', title: 'Self' },
    { slug: 'spaced', genre: ' Fantasy , Action ', title: 'D' },
  ]

  it('orders by shared genre count and excludes the current series', () => {
    const related = selectRelatedSeries(self, candidates)
    // Two shared genres first, ties broken by title (A before D), then one match.
    expect(related.map((r) => r.slug)).toEqual(['two-match', 'spaced', 'one-match'])
    expect(related[1].sharedGenres).toEqual(['Fantasy', 'Action'])
  })

  it('never returns unrelated series', () => {
    expect(selectRelatedSeries(self, [{ slug: 'x', genre: 'Romance' }])).toEqual([])
  })

  it('respects the limit and empty inputs', () => {
    expect(selectRelatedSeries(self, candidates, 1)).toHaveLength(1)
    expect(selectRelatedSeries(self, [])).toEqual([])
    expect(selectRelatedSeries(self, null)).toEqual([])
    expect(selectRelatedSeries({ slug: 'self', genre: null }, candidates)).toEqual([])
  })

  it('accepts genre arrays', () => {
    const related = selectRelatedSeries({ slug: 'a', genre: ['Action'] }, [{ slug: 'b', genre: ['action'] }])
    expect(related.map((r) => r.slug)).toEqual(['b'])
  })
})

describe('episodeCountLabel', () => {
  it('reads naturally for each case', () => {
    expect(episodeCountLabel(12)).toBe('12 episodes')
    expect(episodeCountLabel(1)).toBe('1 episode')
    expect(episodeCountLabel(null, 'ongoing')).toBe('Airing')
    expect(episodeCountLabel(0, 'upcoming')).toBe('Episodes TBA')
  })
})
