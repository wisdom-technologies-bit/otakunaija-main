/**
 * Seeded fixtures for the newsletter tests and the preview script.
 *
 * Not imported by any route: this is the "realistic but fake" content the unit
 * tests and the six-layout preview render against.
 */

import { selectIssueContent } from "./select"
import type { LayoutId, LayoutVariant } from "./layout"
import { variantFor } from "./layout"
import type { IssueContent, NewsletterCopy, NewsletterPrefs, SelectSources } from "./types"
import { DEFAULT_PREFS } from "./types"
import type { RenderContext } from "./render/context"
import { TOKEN_PLACEHOLDER } from "./render/context"

export const FIXTURE_NOW = new Date("2026-11-09T10:00:00.000Z")

const cloud = (id: string, seed: number) =>
  `https://res.cloudinary.com/otakunaija/image/upload/v1700000000/newsletter/${id}-${seed}.png`

const anilist = (id: number) =>
  `https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/bx${id}-h0VfQK2nWq7Z.jpg`

export function fixtureSources(now: Date = FIXTURE_NOW): SelectSources {
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3_600_000).toISOString()
  const hoursAhead = (hours: number) => new Date(now.getTime() + hours * 3_600_000).toISOString()

  const posts = [
    {
      id: 101,
      slug: "solo-leveling-season-3-confirmed",
      title: "Solo Leveling season 3 is confirmed for next spring",
      excerpt:
        "The studio confirmed a third season at the end of the finale broadcast, with the same director returning and a spring window on the schedule.",
      category: "News",
      coverImage: cloud("solo-leveling", 1),
      views: 18420,
      featured: true,
      publishedAt: hoursAgo(6),
    },
    {
      id: 102,
      slug: "jujutsu-kaisen-culling-game-arc-anime",
      title: "The Culling Game arc gets a full anime adaptation",
      excerpt:
        "Production has started on the next arc, with the first teaser due at the studio's winter event. No release window has been announced.",
      category: "News",
      coverImage: cloud("jujutsu", 2),
      views: 12980,
      featured: false,
      publishedAt: hoursAgo(9),
    },
    {
      id: 103,
      slug: "one-piece-egghead-finale-review",
      title: "One Piece closes the Egghead arc on its strongest episode yet",
      excerpt:
        "The finale pulls the arc's threads together without rushing them, and the animation team gets one clean, quiet beat at the end.",
      category: "Action",
      coverImage: cloud("one-piece", 3),
      views: 9310,
      featured: false,
      publishedAt: hoursAgo(14),
    },
    {
      id: 104,
      slug: "five-romance-anime-for-friday-night",
      title: "Five romance anime that are worth a Friday night",
      excerpt:
        "No love triangles that drag, no filler arcs. These are the ones that respect your time and still land the ending.",
      category: "Romance",
      coverImage: cloud("romance", 4),
      views: 7420,
      featured: false,
      publishedAt: hoursAgo(18),
    },
    {
      id: 105,
      slug: "chainsaw-man-movie-nigeria-cinemas",
      title: "The Chainsaw Man film reaches Nigerian cinemas this month",
      excerpt:
        "Two Lagos venues have listed screenings, with subtitled and dubbed options across the opening weekend.",
      category: "News",
      coverImage: cloud("chainsaw", 5),
      views: 6105,
      featured: false,
      publishedAt: hoursAgo(20),
    },
    {
      id: 106,
      slug: "how-to-watch-anime-in-nigeria-guide",
      title: "A practical guide to watching anime in Nigeria in 2026",
      excerpt:
        "Which services actually work here, what data each one burns, and how to keep an offline queue for the bad network days.",
      category: "Guides",
      coverImage: null,
      views: 4310,
      featured: false,
      publishedAt: hoursAgo(22),
    },
    {
      id: 107,
      slug: "demon-slayer-infinity-castle-trailer",
      title: "Demon Slayer's Infinity Castle trailer breaks the studio's record",
      excerpt: "The two-minute trailer crossed 40 million views in five days.",
      category: "News",
      coverImage: cloud("demon-slayer", 6),
      views: 15230,
      featured: true,
      publishedAt: hoursAgo(56),
    },
  ]

  const seriesSeed = [
    { id: 1, slug: "solo-leveling", title: "Solo Leveling", poster: anilist(151807) },
    { id: 2, slug: "jujutsu-kaisen", title: "Jujutsu Kaisen", poster: anilist(113415) },
    { id: 3, slug: "one-piece", title: "One Piece", poster: anilist(21) },
    { id: 4, slug: "dandadan", title: "Dandadan", poster: anilist(153518) },
    { id: 5, slug: "frieren", title: "Frieren: Beyond Journey's End", poster: anilist(154587) },
    { id: 6, slug: "blue-lock", title: "Blue Lock", poster: anilist(137822) },
    { id: 7, slug: "apothecary-diaries", title: "The Apothecary Diaries", poster: anilist(161645) },
    { id: 8, slug: "sakamoto-days", title: "Sakamoto Days", poster: anilist(163134) },
  ]

  const episodes = seriesSeed.flatMap((series, seriesIndex) =>
    [1, 2].map((offset) => ({
      id: series.id * 10 + offset,
      episodeNumber: 9 + offset + seriesIndex,
      title: `Episode ${9 + offset + seriesIndex}`,
      slug: `episode-${9 + offset + seriesIndex}`,
      seriesId: series.id,
      seriesSlug: series.slug,
      seriesTitle: series.title,
      seriesPoster: series.poster,
      thumbnail: cloud(`${series.slug}-thumb`, seriesIndex + offset),
      publishedAt: hoursAgo(3 + seriesIndex * 2 + offset),
      durationSeconds: 1440,
      adult: false,
    })),
  )

  const airing = [
    { anilistId: 21, title: "One Piece", episode: 1140, at: hoursAhead(6), popularity: 420000 },
    { anilistId: 113415, title: "Jujutsu Kaisen", episode: 48, at: hoursAhead(11), popularity: 390000 },
    { anilistId: 151807, title: "Solo Leveling", episode: 26, at: hoursAhead(22), popularity: 350000 },
    { anilistId: 153518, title: "Dandadan", episode: 21, at: hoursAhead(29), popularity: 280000 },
    { anilistId: 154587, title: "Frieren: Beyond Journey's End", episode: 34, at: hoursAhead(50), popularity: 260000 },
    { anilistId: 137822, title: "Blue Lock", episode: 40, at: hoursAhead(74), popularity: 210000 },
    { anilistId: 161645, title: "The Apothecary Diaries", episode: 31, at: hoursAhead(98), popularity: 190000 },
    { anilistId: 163134, title: "Sakamoto Days", episode: 18, at: hoursAhead(120), popularity: 175000 },
  ].map((row) => ({
    anilistId: row.anilistId,
    title: row.title,
    episode: row.episode,
    airingAt: row.at,
    coverUrl: anilist(row.anilistId),
    siteUrl: null,
    popularity: row.popularity,
    adult: false,
  }))

  const upcoming = [
    { anilistId: 170942, title: "Witch Hat Atelier", startDate: "2027-01-10", popularity: 210000, format: "TV" },
    { anilistId: 178025, title: "Kagurabachi", startDate: "2027-02-04", popularity: 180000, format: "TV" },
    { anilistId: 166531, title: "Chainsaw Man: Reze Arc", startDate: "2027-01-24", popularity: 165000, format: "MOVIE" },
  ].map((row) => ({
    anilistId: row.anilistId,
    title: row.title,
    startDate: row.startDate,
    coverUrl: anilist(row.anilistId),
    siteUrl: null,
    format: row.format,
    seasonYear: 2027,
    season: "WINTER",
    popularity: row.popularity,
    adult: false,
  }))

  const trending = [
    { slug: "one-piece", title: "One Piece", poster: anilist(21), totalViews: 184200 },
    { slug: "solo-leveling", title: "Solo Leveling", poster: anilist(151807), totalViews: 161400 },
    { slug: "dandadan", title: "Dandadan", poster: anilist(153518), totalViews: 128900 },
  ]

  return { posts, episodes, airing, upcoming, trending }
}

export const FIXTURE_COPY: NewsletterCopy = {
  subject: "Solo Leveling season 3 is confirmed",
  preheader: "Also: the Culling Game arc gets a full adaptation, and 16 new episodes.",
  editorsNote:
    "Two confirmations landed overnight, and neither is a rumour: Solo Leveling returns in spring and the Culling Game arc is greenlit. Sixteen episodes are waiting below if you would rather watch than read.",
  blurbs: {
    "101": "The finale broadcast ended with a date, not a teaser.",
    "102": "Production has started, so this one is real.",
    "103": "The arc closes on a quiet beat instead of a fight.",
  },
  generatedBy: "fallback",
  attempts: 0,
}

export type FixtureLayout = {
  layout: LayoutId
  /** A date whose weekday triggers the layout. */
  date: string
  now: Date
}

/** One fixture per layout, each on a weekday that would really choose it. */
export const LAYOUT_FIXTURES: Record<LayoutId, FixtureLayout> = {
  "week-ahead": { layout: "week-ahead", date: "2026-11-09", now: new Date("2026-11-09T06:00:00.000Z") },
  "lead-story": { layout: "lead-story", date: "2026-11-10", now: new Date("2026-11-10T06:00:00.000Z") },
  "episode-drop": { layout: "episode-drop", date: "2026-11-11", now: new Date("2026-11-11T06:00:00.000Z") },
  "quiet-day": { layout: "quiet-day", date: "2026-11-12", now: new Date("2026-11-12T06:00:00.000Z") },
  "weekend-watch": { layout: "weekend-watch", date: "2026-11-13", now: new Date("2026-11-13T06:00:00.000Z") },
  roundup: { layout: "roundup", date: "2026-11-15", now: new Date("2026-11-15T06:00:00.000Z") },
}

export function fixtureContent(options: {
  now?: Date
  lastSentAt?: Date | null
  sparse?: boolean
} = {}): IssueContent {
  const now = options.now ?? FIXTURE_NOW
  const sources = fixtureSources(now)
  if (options.sparse) {
    sources.episodes = sources.episodes.slice(0, 1)
    sources.airing = []
    sources.upcoming = []
    sources.trending = []
    sources.posts = sources.posts.slice(0, 2)
  }

  return selectIssueContent({
    now,
    lastSentAt: options.lastSentAt ?? new Date(now.getTime() - 24 * 3_600_000),
    sources,
    excludePostIds: [],
    siteBaseUrl: "https://otakunaija.name.ng",
  })
}

export function fixtureContext(options: {
  layout?: LayoutId
  variant?: LayoutVariant
  prefs?: NewsletterPrefs
  sparse?: boolean
  now?: Date
  date?: string
  dateLabel?: string
  token?: string
} = {}): RenderContext {
  const layout = options.layout ?? "lead-story"
  const fixture = LAYOUT_FIXTURES[layout]
  const now = options.now ?? fixture.now
  const date = options.date ?? fixture.date

  return {
    content: fixtureContent({ now, sparse: options.sparse ?? layout === "quiet-day" }),
    copy: FIXTURE_COPY,
    variant: options.variant ?? variantFor(0),
    prefs: options.prefs ?? DEFAULT_PREFS,
    issueDate: date,
    dateLabel: options.dateLabel ?? "Monday 9 November",
    token: options.token ?? TOKEN_PLACEHOLDER,
    brand: {
      siteUrl: "https://otakunaija.name.ng",
      fromName: "OtakuNaija",
      postalAddress: "OtakuNaija, 14 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
      logoUrl: null,
      replyTo: "press@otakunaija.name.ng",
    },
  }
}

/** The six layouts in the order the preview page lists them. */
export function allLayoutContexts(): { layout: LayoutId; ctx: RenderContext }[] {
  return (["lead-story", "episode-drop", "week-ahead", "weekend-watch", "roundup", "quiet-day"] as LayoutId[]).map(
    (layout) => ({ layout, ctx: fixtureContext({ layout }) }),
  )
}
