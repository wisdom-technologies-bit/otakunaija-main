import { describe, expect, it } from "vitest"
import { fetchArticle, fetchFeed } from "./ann"
import { selectFeedItems, parseBlockedKeywords } from "./filters"
import { rewriteArticle } from "./rewrite"

const LIVE = process.env.LIVE_ANN === "1"

describe.runIf(LIVE)("live ANN dry run", () => {
  it("fetches, parses and selects from the real feed", async () => {
    const now = new Date()
    const started = Date.now()
    const feed = await fetchFeed()
    if (!feed.ok) throw new Error(`feed failed: ${feed.error}`)

    const items = feed.data.items
    const selection = selectFeedItems(items, {
      now,
      maxAgeHours: 72,
      blockedKeywords: parseBlockedKeywords(process.env.NEWS_BLOCKED_KEYWORDS),
    })

    console.log(`\n[feed] fetched=${items.length} in ${Date.now() - started}ms from https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w`)
    console.log(`[feed] newest=${items[0]?.publishedAt} oldest=${items[items.length - 1]?.publishedAt}`)
    console.log(`[queue] would_insert_pending=${selection.accepted.length} too_old_72h=${selection.tooOld.length} filtered=${selection.filtered.length}`)
    console.log(`[queue] filtered reasons=${JSON.stringify(selection.filtered.slice(0, 5).map((entry) => ({ title: entry.item.title, reason: entry.reason })))}`)
    console.log(`[queue] first ${Math.min(5, selection.accepted.length)} rows that would be inserted:`)
    for (const item of selection.accepted.slice(0, 5)) {
      console.log(
        `   - ${item.publishedAt} | topics=${JSON.stringify(item.topics)} | image=${item.imageUrl ? "feed" : "article"} | ${item.title}`,
      )
      console.log(`     ${item.link}`)
    }

    expect(items.length).toBeGreaterThan(10)

    const sample = selection.accepted[0] ?? items[0]
    const article = await fetchArticle(sample.link)
    if (!article.ok) throw new Error(`article failed: ${article.error}`)
    console.log(`\n[article] ${sample.link}`)
    console.log(`[article] title=${article.data.title}`)
    console.log(`[article] og:image=${article.data.imageUrl}`)
    console.log(`[article] paragraphs=${article.data.paragraphs.length} chars=${article.data.text.length}`)
    console.log(`[article] first paragraph: ${article.data.paragraphs[0]?.slice(0, 180)}...`)

    const rewrite = await rewriteArticle({
      title: sample.title,
      text: article.data.text,
      url: sample.link,
      topics: sample.topics,
    })
    console.log(`\n[groq] GROQ_API_KEY configured=${Boolean(process.env.GROQ_API_KEY)} -> ${JSON.stringify(rewrite)}`)
    expect(rewrite.ok).toBe(false)
  }, 60_000)
})
