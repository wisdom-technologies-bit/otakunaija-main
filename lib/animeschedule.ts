const BASE = 'https://animeschedule.net/api/v3'

export type AsCategory = { name: string; route: string }
export type AsStream = { platform: string; name: string; url: string }

export interface AnimeScheduleInfo {
  year: number | null
  premier: string | null
  seasonTitle: string | null
  status: string | null
  totalEpisodes: number | null
  lengthMin: number | null
  romaji: string | null
  english: string | null
  native: string | null
  posterColor: string | null
  genres: AsCategory[]
  studios: AsCategory[]
  sources: AsCategory[]
  mediaTypes: AsCategory[]
  notes: string | null
  delayText: string | null
  jpnTime: string | null
  subTime: string | null
  dubTime: string | null
  stats: {
    score: number
    ratingCount: number
    tracked: number
    dropped: number
    rank: number | null
  } | null
  streams: AsStream[]
  links: { label: string; url: string }[]
  related: { label: string; slugs: string[] }[]
}

// API uses 0001-01-01 and 0 as "no value"
const cleanDate = (d?: string | null) => (!d || d.startsWith('0001-') ? null : d)
const cleanNum = (n?: number | null) => (n && n > 0 ? n : null)
const cleanStr = (s?: string | null) => (s && s.trim() ? s.trim() : null)
const toText = (html?: string | null) =>
  cleanStr(
    (html ?? '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\(Source:[^)]*\)/gi, '')
  )
const https = (u?: string | null) =>
  !u ? null : /^https?:\/\//.test(u) ? u : `https://${u}`

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(a: any): AnimeScheduleInfo {
  const s = a.stats
  const w = a.websites ?? {}
  const rel = a.relations ?? {}
  const links = [
    ['Official site', w.official],
    ['MyAnimeList', w.mal],
    ['AniList', w.aniList],
    ['Kitsu', w.kitsu],
    ['Anime-Planet', w.animePlanet],
    ['AniDB', w.anidb],
  ]
    .map(([label, url]) => ({ label: label as string, url: https(url as string) }))
    .filter((l): l is { label: string; url: string } => !!l.url)

  const relGroups: [string, string][] = [
    ['Prequels', 'prequels'],
    ['Sequels', 'sequels'],
    ['Parent story', 'parents'],
    ['Spin-offs', 'spinoffs'],
    ['Alternatives', 'alternatives'],
    ['Movies & specials', 'sideStories'],
  ]

  return {
    year: cleanNum(a.year),
    premier: cleanDate(a.premier),
    seasonTitle: cleanStr(a.season?.title),
    status: cleanStr(a.status),
    totalEpisodes: cleanNum(a.episodes),
    lengthMin: cleanNum(a.lengthMin),
    romaji: cleanStr(a.names?.romaji),
    english: cleanStr(a.names?.english),
    native: cleanStr(a.names?.native),
    posterColor: cleanStr(a.posterDominantColor),
    genres: a.genres ?? [],
    studios: a.studios ?? [],
    sources: a.sources ?? [],
    mediaTypes: a.mediaTypes ?? [],
    notes: toText(a.notes),
    delayText: a.delayedTimetable || a.status === 'Delayed' ? toText(a.delayedDesc) : null,
    jpnTime: cleanDate(a.jpnTime),
    subTime: cleanDate(a.subTime),
    dubTime: cleanDate(a.dubTime),
    stats:
      s && s.ratingCount > 0
        ? {
            score: s.averageScore,
            ratingCount: s.ratingCount,
            tracked: s.trackedCount ?? 0,
            dropped: s.droppedCount ?? 0,
            rank: cleanNum(s.trackedRating),
          }
        : null,
    streams: (a.websites?.streams ?? [])
      .map((x: AsStream) => ({ ...x, url: https(x.url) }))
      .filter((x: { url: string | null }) => !!x.url),
    links,
    related: relGroups
      .map(([label, key]) => ({ label, slugs: (rel[key] ?? []) as string[] }))
      .filter((g) => g.slugs.length > 0),
  }
}

export async function getAnimeScheduleInfo(slug: string): Promise<AnimeScheduleInfo | null> {
  const token = process.env.ANIMESCHEDULE_TOKEN
  if (!token) return null
  try {
    const res = await fetch(`${BASE}/anime/${encodeURIComponent(slug)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return null
    return normalize(await res.json())
  } catch {
    return null
  }
}

export interface AsSearchHit {
  route: string
  title: string
  english: string | null
  romaji: string | null
  aniListId: number | null
}

export async function searchAnimeSchedule(q: string): Promise<AsSearchHit[]> {
  const token = process.env.ANIMESCHEDULE_TOKEN
  if (!token) return []
  try {
    const res = await fetch(`${BASE}/anime?q=${encodeURIComponent(q)}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!res.ok) return []
    const json = await res.json()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (json.anime ?? []).map((a: any) => ({
      route: a.route,
      title: a.title,
      english: a.names?.english ?? null,
      romaji: a.names?.romaji ?? null,
      aniListId: Number(/anime\/(\d+)/.exec(a.websites?.aniList ?? '')?.[1]) || null,
    }))
  } catch {
    return []
  }
}
