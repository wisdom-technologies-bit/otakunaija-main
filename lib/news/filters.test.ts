import { describe, expect, it } from "vitest"
import type { FeedItem } from "./ann"
import {
  isAnimeRelated,
  isBlockedTitle,
  isNewsUrl,
  isWithinWindow,
  parseBlockedKeywords,
  selectFeedItems,
} from "./filters"

function item(overrides: Partial<FeedItem> & { guid: string }): FeedItem {
  return {
    title: "Some Anime News",
    link: `https://www.animenewsnetwork.com/news/${overrides.guid}`,
    description: "",
    publishedAt: "2026-11-08T10:00:00.000Z",
    topics: ["Anime"],
    imageUrl: null,
    ...overrides,
  }
}

const NOW = new Date("2026-11-08T12:00:00.000Z")

describe("isWithinWindow", () => {
  it("keeps items inside 72 hours and drops older ones", () => {
    expect(isWithinWindow("2026-11-08T09:00:00.000Z", NOW)).toBe(true)
    expect(isWithinWindow("2026-11-05T12:00:01.000Z", NOW)).toBe(true)
    expect(isWithinWindow("2026-11-05T11:59:00.000Z", NOW)).toBe(false)
  })

  it("treats unknown or future dates as fresh", () => {
    expect(isWithinWindow(null, NOW)).toBe(true)
    expect(isWithinWindow("not-a-date", NOW)).toBe(true)
    expect(isWithinWindow("2026-11-09T00:00:00.000Z", NOW)).toBe(true)
  })
})

describe("parseBlockedKeywords / isBlockedTitle", () => {
  it("parses a comma separated list case-insensitively", () => {
    expect(parseBlockedKeywords(" pachinko , Giveaway,, ")).toEqual(["pachinko", "giveaway"])
    expect(parseBlockedKeywords(undefined)).toEqual([])
  })

  it("matches any keyword inside the title", () => {
    expect(isBlockedTitle("New Pachinko Machine Revealed", ["pachinko"])).toBe(true)
    expect(isBlockedTitle("New Anime Revealed", ["pachinko"])).toBe(false)
    expect(isBlockedTitle("anything", [])).toBe(false)
  })
})

describe("isAnimeRelated", () => {
  it("accepts anime/manga/game topics", () => {
    expect(isAnimeRelated({ title: "x", topics: ["Anime"] })).toBe(true)
    expect(isAnimeRelated({ title: "x", topics: ["Manga"] })).toBe(true)
    expect(isAnimeRelated({ title: "x", topics: ["Games"] })).toBe(true)
  })

  it("falls back to title hints for ambiguous topics", () => {
    expect(isAnimeRelated({ title: "New Live-Action Anime Adaptation Announced", topics: ["Live-Action"] })).toBe(true)
    expect(isAnimeRelated({ title: "Studio Ghibli Retrospective", topics: ["Events"] })).toBe(true)
  })

  it("rejects clearly unrelated items but keeps unknown topics", () => {
    expect(isAnimeRelated({ title: "Broadway Ticket Sales Soar", topics: ["People"] })).toBe(false)
    expect(isAnimeRelated({ title: "Something with no topic at all", topics: [] })).toBe(true)
  })
})

describe("isNewsUrl", () => {
  it("rejects reviews, features, interviews, columns and contests", () => {
    expect(isNewsUrl("https://www.animenewsnetwork.com/news/2026-11-08/x/.1")).toBe(true)
    expect(isNewsUrl("https://www.animenewsnetwork.com/review/the-makeup-remover/volume-2/.243068")).toBe(false)
    expect(isNewsUrl("https://www.animenewsnetwork.com/feature/2026-11-01/x/.2")).toBe(false)
    expect(isNewsUrl("https://www.animenewsnetwork.com/interview/2026-10-30/x/.3")).toBe(false)
  })
})

describe("selectFeedItems", () => {
  it("splits fresh, too-old and policy-filtered items", () => {
    const selection = selectFeedItems(
      [
        item({ guid: "fresh-1" }),
        item({ guid: "old-1", publishedAt: "2026-10-01T10:00:00.000Z" }),
        item({ guid: "blocked-1", title: "Pachinko Machine Announced" }),
        item({ guid: "off-topic-1", title: "Broadway Sales Soar", topics: ["People"] }),
        item({ guid: "review-1", link: "https://www.animenewsnetwork.com/review/x/.9", title: "Some Anime Review" }),
      ],
      { now: NOW, blockedKeywords: ["pachinko"] },
    )

    expect(selection.accepted.map((entry) => entry.guid)).toEqual(["fresh-1"])
    expect(selection.tooOld.map((entry) => entry.guid)).toEqual(["old-1"])
    expect(selection.filtered).toEqual([
      expect.objectContaining({ reason: "blocked_keyword" }),
      expect.objectContaining({ reason: "off_topic" }),
      expect.objectContaining({ reason: "not_news" }),
    ])
  })

  it("dedupes guids inside a single feed and against already-seen rows", () => {
    const selection = selectFeedItems(
      [item({ guid: "dup" }), item({ guid: "dup" }), item({ guid: "seen" }), item({ guid: "new" })],
      { now: NOW, seen: ["seen"] },
    )

    expect(selection.accepted.map((entry) => entry.guid)).toEqual(["dup", "new"])
    expect(selection.tooOld).toHaveLength(0)
    expect(selection.filtered).toHaveLength(0)
  })
})
