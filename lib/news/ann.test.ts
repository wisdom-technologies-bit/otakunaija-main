import { describe, expect, it } from "vitest"
import { extractArticle, firstImageFromHtml, normalizeUrl, parseFeed, pickFeedImage, textOf } from "./ann"

const ITEM_WITH_ENCLOSURE = `
<item>
  <title>Spy×Family Anime Gets 4th Season, Theatrical Film in 2027</title>
  <link>https://www.animenewsnetwork.com/news/2026-11-08/spy-family-anime-gets-4th-season/.243614</link>
  <guid isPermaLink="true">https://www.animenewsnetwork.com/cms/.243614</guid>
  <description>Visual revealed for new season</description>
  <pubDate>Sun, 08 Nov 2026 06:00:18 -0500</pubDate>
  <category>Anime</category>
  <category>Manga</category>
  <enclosure url="https://cdn.animenewsnetwork.com/thumbnails/crop600x315/spy.jpg" type="image/jpeg" length="0" />
</item>`

const ITEM_WITHOUT_IMAGE = `
<item>
  <title>The Makeup Remover Volume 2 K-Comic Review</title>
  <link>/review/the-makeup-remover/volume-2/.243068</link>
  <guid>https://www.animenewsnetwork.com/cms/.243068</guid>
  <description><![CDATA[If you're not Barbie-perfect, you've lost.]]></description>
  <pubDate>Sun, 08 Nov 2026 12:00:00 -0500</pubDate>
  <category>Korean</category>
</item>`

const ITEM_WITH_CDATA_AND_ENTITIES = `
<item>
  <title><![CDATA[Fist of the North Star &amp; the 1980s boom]]></title>
  <link>https://www.animenewsnetwork.com/news/2026-11-07/fist-of-the-north-star/.243600</link>
  <guid isPermaLink="false">ann-243600</guid>
  <description>&lt;p&gt;A retrospective &amp;mdash; with &amp;quot;quotes&amp;quot;.&lt;/p&gt;&lt;img src="//cdn.animenewsnetwork.com/cms/thumb.png" /&gt;</description>
  <pubDate>Sat, 07 Nov 2026 09:30:00 -0500</pubDate>
  <media:thumbnail url="https://cdn.animenewsnetwork.com/thumbnails/media-thumb.jpg" />
</item>`

function wrap(items: string) {
  return `<?xml version="1.0" encoding="utf-8" ?>
<rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
  <channel>
    <title>Anime News Network</title>
    <link>https://www.animenewsnetwork.com/</link>
    ${items}
  </channel>
</rss>`
}

describe("parseFeed", () => {
  it("parses a standard RSS item with enclosure, topics and pubDate", () => {
    const result = parseFeed(wrap(ITEM_WITH_ENCLOSURE))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.items).toHaveLength(1)
    const [item] = result.data.items
    expect(item.title).toContain("Spy×Family")
    expect(item.guid).toBe("https://www.animenewsnetwork.com/cms/.243614")
    expect(item.link).toBe("https://www.animenewsnetwork.com/news/2026-11-08/spy-family-anime-gets-4th-season/.243614")
    expect(item.topics).toEqual(["Anime", "Manga"])
    expect(item.imageUrl).toBe("https://cdn.animenewsnetwork.com/thumbnails/crop600x315/spy.jpg")
    expect(item.publishedAt).toBe(new Date("Sun, 08 Nov 2026 06:00:18 -0500").toISOString())
  })

  it("survives a missing image and resolves protocol-relative links", () => {
    const result = parseFeed(wrap(ITEM_WITHOUT_IMAGE))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const [item] = result.data.items
    expect(item.imageUrl).toBeNull()
    expect(item.link).toBe("https://www.animenewsnetwork.com/review/the-makeup-remover/volume-2/.243068")
    expect(item.description).toBe("If you're not Barbie-perfect, you've lost.")
  })

  it("handles CDATA titles, HTML entities and media:thumbnail", () => {
    const result = parseFeed(wrap(ITEM_WITH_CDATA_AND_ENTITIES))
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const [item] = result.data.items
    expect(item.title).toBe("Fist of the North Star & the 1980s boom")
    expect(item.guid).toBe("ann-243600")
    expect(item.imageUrl).toBe("https://cdn.animenewsnetwork.com/thumbnails/media-thumb.jpg")
    expect(item.description).toContain("A retrospective")
    expect(item.description).toContain('"quotes"')
  })

  it("falls back to the first <img> in the description", () => {
    const result = parseFeed(
      wrap(`
      <item>
        <title>Dandadan Season 2 Announced</title>
        <link>https://www.animenewsnetwork.com/news/1/.1</link>
        <guid>guid-1</guid>
        <description>&lt;img src="//cdn.animenewsnetwork.com/inline.jpg" /&gt; Teaser out.</description>
        <pubDate>Sun, 08 Nov 2026 01:00:00 -0500</pubDate>
        <category>Anime</category>
      </item>`),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.items[0].imageUrl).toBe("https://cdn.animenewsnetwork.com/inline.jpg")
  })

  it("rejects documents that are not RSS and feeds with no items", () => {
    expect(parseFeed("<html><body>blocked</body></html>")).toEqual({ ok: false, error: "not_an_rss_document" })
    expect(parseFeed(wrap("")).ok).toBe(false)
  })

  it("drops items without a title or link", () => {
    const result = parseFeed(
      wrap(`<item><title>Only a title</title></item><item><link>https://example.com/x</link></item>`),
    )
    expect(result.ok).toBe(false)
  })
})

describe("feed helpers", () => {
  it("textOf unwraps strings, CDATA, #text and arrays", () => {
    expect(textOf("plain")).toBe("plain")
    expect(textOf({ "#cdata": "cdata" })).toBe("cdata")
    expect(textOf({ "#text": "text", "@_attr": "x" })).toBe("text")
    expect(textOf([{ "#cdata": "a" }, "b"])).toBe("a b")
    expect(textOf(undefined)).toBe("")
  })

  it("normalizeUrl handles protocol-relative, root-relative and junk values", () => {
    expect(normalizeUrl("//cdn.animenewsnetwork.com/a.jpg")).toBe("https://cdn.animenewsnetwork.com/a.jpg")
    expect(normalizeUrl("/news/x")).toBe("https://www.animenewsnetwork.com/news/x")
    expect(normalizeUrl("https://example.com/a.jpg")).toBe("https://example.com/a.jpg")
    expect(normalizeUrl("javascript:alert(1)")).toBeNull()
    expect(normalizeUrl("")).toBeNull()
  })

  it("firstImageFromHtml and pickFeedImage prefer the explicit enclosure", () => {
    expect(firstImageFromHtml('<p>x</p><img src="//cdn.x/y.jpg">')).toBe("https://cdn.x/y.jpg")
    expect(firstImageFromHtml("<p>no image</p>")).toBeNull()
    expect(pickFeedImage({ "media:content": { "@_url": "https://cdn.x/media.jpg" } })).toBe("https://cdn.x/media.jpg")
  })
})

const ARTICLE_HTML = `<!doctype html>
<html><head>
  <meta property="og:title" content="Spy×Family Anime Gets 4th Season, Theatrical Film in 2027">
  <meta property="og:image" content="//cdn.animenewsnetwork.com/thumbnails/crop600x315/spy.jpg">
  <script>window.ads = true</script>
</head>
<body>
  <h1>News Spy×Family Anime Gets 4th Season</h1>
  <div class="KonaBody">
    <div class="intro">Visual revealed for new season</div>
    <div class="meat">
      <p>The staff for the Spy×Family anime announced on Sunday that the series is receiving a fourth season as well as a new film in theatres in Japan in 2027.</p>
      <script>track()</script>
      <p>The first season premiered in April 2022 and the second season followed in October 2023, airing for 12 episodes before the third season arrived in 2025.</p>
      <figure><img src="//cdn.animenewsnetwork.com/inline.jpg"><figcaption class="credit">Image courtesy of Toho</figcaption></figure>
      <p>Shueisha publishes the manga in English through MANGA Plus and Viz Media, and the 18th compiled volume shipped on November 4 this year.</p>
      <p>Source: Press release</p>
    </div>
  </div>
  <aside class="related"><p>Related: something that should not be extracted at all from the sidebar.</p></aside>
</body></html>`

describe("extractArticle", () => {
  it("extracts paragraphs and og:image, dropping scripts, captions, credits and sidebars", () => {
    const result = extractArticle(ARTICLE_HTML, "https://www.animenewsnetwork.com/news/x/.1")
    expect(result.ok).toBe(true)
    if (!result.ok) return

    expect(result.data.title).toBe("Spy×Family Anime Gets 4th Season, Theatrical Film in 2027")
    expect(result.data.imageUrl).toBe("https://cdn.animenewsnetwork.com/thumbnails/crop600x315/spy.jpg")
    expect(result.data.paragraphs.length).toBeGreaterThanOrEqual(2)
    expect(result.data.text).toContain("fourth season")
    expect(result.data.text).not.toContain("track()")
    expect(result.data.text).not.toContain("Image courtesy of Toho")
    expect(result.data.text).not.toContain("Source: Press release")
    expect(result.data.text).not.toContain("should not be extracted")
  })

  it("reports an error when the page has no usable body text", () => {
    const result = extractArticle("<html><body><p>Short.</p></body></html>", "https://www.animenewsnetwork.com/x")
    expect(result).toEqual({ ok: false, error: "insufficient_article_text" })
  })
})
