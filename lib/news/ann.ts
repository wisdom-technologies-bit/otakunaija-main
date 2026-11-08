import { XMLParser } from "fast-xml-parser"
import * as cheerio from "cheerio"

/**
 * Anime News Network reader.
 *
 * Everything in this module is defensive: the cron route must never throw
 * because ANN changed its markup, rate-limited us, or timed out. Failures are
 * returned as data (`{ ok: false, error }`) so the caller can retry later.
 */

export const ANN_FEED_URL =
  process.env.NEWS_FEED_URL?.trim() || "https://www.animenewsnetwork.com/all/rss.xml?ann-edition=w"

export const ANN_SITE = "https://www.animenewsnetwork.com"
export const USER_AGENT = "OtakuNaijaBot/1.0 (+https://otakunaija.name.ng)"

const FEED_TIMEOUT_MS = 15_000
const ARTICLE_TIMEOUT_MS = 15_000
const MAX_ARTICLE_CHARS = 12_000
const MIN_ARTICLE_CHARS = 200

export type FetchResult<T> = { ok: true; data: T } | { ok: false; error: string }

export type FeedItem = {
  /** Stable dedupe key. ANN's <guid> is a cms URL, which we prefer over the article URL. */
  guid: string
  title: string
  link: string
  description: string
  /** ISO string, or null when the feed had no parseable pubDate. */
  publishedAt: string | null
  topics: string[]
  imageUrl: string | null
}

export type ArticleContent = {
  url: string
  title: string | null
  imageUrl: string | null
  paragraphs: string[]
  text: string
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  cdataPropName: "#cdata",
  textNodeName: "#text",
  processEntities: true,
  htmlEntities: true,
  trimValues: true,
  // Keep every leaf as a string: pubDate/guid must not be coerced to numbers.
  parseTagValue: false,
  parseAttributeValue: false,
})

function asArray<T>(value: T | T[] | undefined | null): T[] {
  if (value === undefined || value === null) return []
  return Array.isArray(value) ? value : [value]
}

/** Fast-XML-Parser gives us strings, CDATA objects, `#text` objects or arrays. */
export function textOf(node: unknown): string {
  if (node === null || node === undefined) return ""
  if (typeof node === "string") return node
  if (typeof node === "number" || typeof node === "boolean") return String(node)
  if (Array.isArray(node)) return node.map(textOf).filter(Boolean).join(" ").trim()
  if (typeof node === "object") {
    const record = node as Record<string, unknown>
    if (record["#cdata"] !== undefined) {
      const cdata = textOf(record["#cdata"])
      if (cdata) return cdata
    }
    if (record["#text"] !== undefined) {
      const text = textOf(record["#text"])
      if (text) return text
    }
    return Object.entries(record)
      .filter(([key]) => !key.startsWith("@_"))
      .map(([, value]) => textOf(value))
      .filter(Boolean)
      .join(" ")
      .trim()
  }
  return ""
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  mdash: "—",
  ndash: "–",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  ldquo: "“",
  rdquo: "”",
  copy: "©",
}

/**
 * ANN double-escapes entities inside CDATA (`&amp;` arrives literally), so the
 * feed text is decoded once after parsing. URLs are never passed through here.
 */
export function decodeEntities(input: string): string {
  if (!input || !input.includes("&")) return input
  return input
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => safeCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => safeCodePoint(Number.parseInt(dec, 10)))
    .replace(/&([a-z][a-z0-9]*);/gi, (match, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? match)
}

function safeCodePoint(code: number): string {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return ""
  try {
    return String.fromCodePoint(code)
  } catch {
    return ""
  }
}

/** `//cdn…` → `https:`; `/news/…` → ANN absolute; anything else non-http is dropped. */
export function normalizeUrl(input: string | null | undefined): string | null {
  if (!input) return null
  const url = input.trim()
  if (!url) return null
  if (url.startsWith("//")) return `https:${url}`
  if (url.startsWith("/")) return `${ANN_SITE}${url}`
  if (/^https?:\/\//i.test(url)) return url
  return null
}

export function firstImageFromHtml(html: string | null | undefined): string | null {
  if (!html) return null
  const match = /<img[^>]+src=["']([^"']+)["']/i.exec(html)
  return normalizeUrl(match?.[1] ?? null)
}

function pickAttribute(node: unknown, attribute: string): string | null {
  if (!node || typeof node !== "object") return null
  const record = node as Record<string, unknown>
  const value = record[`@_${attribute}`]
  if (typeof value === "string") return normalizeUrl(value)
  return null
}

/**
 * Image discovery order: <enclosure url>, <media:thumbnail url>,
 * <media:content url>, then the first <img> inside the description.
 */
export function pickFeedImage(item: Record<string, unknown>): string | null {
  const enclosure = asArray(item.enclosure)
  for (const candidate of enclosure) {
    const url = pickAttribute(candidate, "url") ?? normalizeUrl(textOf(candidate))
    if (url) return url
  }

  const mediaThumb = asArray(item["media:thumbnail"] ?? item["media:group"])
  for (const candidate of mediaThumb) {
    if (!candidate || typeof candidate !== "object") continue
    const record = candidate as Record<string, unknown>
    const direct = pickAttribute(candidate, "url")
    if (direct) return direct
    const nested = asArray(record["media:thumbnail"])
    for (const inner of nested) {
      const url = pickAttribute(inner, "url")
      if (url) return url
    }
  }

  for (const candidate of asArray(item["media:content"])) {
    const url = pickAttribute(candidate, "url")
    if (url) return url
  }

  return firstImageFromHtml(textOf(item.description))
}

function parseDate(input: string): string | null {
  if (!input) return null
  const date = new Date(input)
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString()
}

function parseFeedItem(raw: unknown): FeedItem | null {
  if (!raw || typeof raw !== "object") return null
  const item = raw as Record<string, unknown>
  const title = textOf(item.title).trim()
  const link = normalizeUrl(textOf(item.link))
  if (!title || !link) return null

  const guid = textOf(item.guid).trim() || link
  const topics = asArray(item.category)
    .map((entry) => decodeEntities(textOf(entry).trim()))
    .filter(Boolean)

  return {
    guid,
    title: decodeEntities(title),
    link,
    description: decodeEntities(textOf(item.description).trim()),
    publishedAt: parseDate(textOf(item.pubDate)),
    topics,
    imageUrl: pickFeedImage(item),
  }
}

/**
 * Pure RSS → FeedItem[] parser (unit tested). Returns `ok: false` when the
 * document has no usable items or is not RSS at all.
 */
export function parseFeed(xml: string): FetchResult<{ items: FeedItem[] }> {
  if (!xml || !xml.includes("<rss")) {
    return { ok: false, error: "not_an_rss_document" }
  }

  let parsed: unknown
  try {
    parsed = parser.parse(xml)
  } catch (error) {
    return { ok: false, error: `feed_parse_error: ${error instanceof Error ? error.message : String(error)}` }
  }

  const channel = (parsed as { rss?: { channel?: unknown } })?.rss?.channel
  const channelRecord = (Array.isArray(channel) ? channel[0] : channel) as Record<string, unknown> | undefined
  const rawItems = asArray(channelRecord?.item)

  const items = rawItems.map(parseFeedItem).filter((item): item is FeedItem => item !== null)
  if (!items.length) return { ok: false, error: "feed_has_no_items" }

  return { ok: true, data: { items } }
}

/** Fetch + parse the ANN RSS feed. Never throws. */
export async function fetchFeed(feedUrl = ANN_FEED_URL): Promise<FetchResult<{ items: FeedItem[] }>> {
  let response: Response
  try {
    response = await fetch(feedUrl, {
      headers: { "User-Agent": USER_AGENT, Accept: "application/rss+xml, application/xml, text/xml;q=0.9, */*;q=0.5" },
      cache: "no-store",
      signal: AbortSignal.timeout(FEED_TIMEOUT_MS),
    })
  } catch (error) {
    return { ok: false, error: `feed_fetch_failed: ${describeError(error)}` }
  }

  if (!response.ok) {
    return { ok: false, error: `feed_http_${response.status}` }
  }

  let xml: string
  try {
    xml = await response.text()
  } catch (error) {
    return { ok: false, error: `feed_read_failed: ${describeError(error)}` }
  }

  return parseFeed(xml)
}

const STRIP_SELECTORS = [
  "script",
  "style",
  "noscript",
  "iframe",
  "ins",
  "form",
  "aside",
  "svg",
  "nav",
  "figure",
  "instaread-player",
  "[class*='ad-']",
  "[class*='advert']",
  ".ad",
  ".ads",
  ".credit",
  ".infobox",
  ".related",
  ".sidebar",
]

function cleanText(input: string): string {
  return input.replace(/\s+/g, " ").trim()
}

/**
 * Pure HTML → article text extractor (unit tested).
 * ANN wraps news copy in `.KonaBody .meat`; we fall back to <article>/<main>
 * so a future redesign degrades instead of breaking.
 */
export function extractArticle(html: string, url: string): FetchResult<ArticleContent> {
  if (!html || html.trim().length === 0) return { ok: false, error: "empty_article_html" }

  const $ = cheerio.load(html)

  // og:title is the clean headline; ANN's <h1> is prefixed with the section
  // ("News Spy×Family…"), so it is only a fallback.
  const title =
    normalizeTitle($('meta[property="og:title"]').attr("content")) ||
    normalizeTitle($('meta[name="title"]').attr("content")) ||
    cleanText($("h1").first().text()) ||
    null

  const ogImage =
    normalizeUrl($('meta[property="og:image"]').attr("content")) ||
    normalizeUrl($('meta[name="twitter:image"]').attr("content")) ||
    normalizeUrl($('link[rel="image_src"]').attr("href"))

  const containerSelectors = [".KonaBody .meat", ".KonaBody", "article", "[role='main']", "main"]
  let container = $()
  for (const selector of containerSelectors) {
    const candidate = $(selector).first()
    if (candidate.length && cleanText(candidate.text()).length > MIN_ARTICLE_CHARS) {
      container = candidate
      break
    }
  }
  if (!container.length) container = $("body").first()

  const body = container.clone()
  body.find(STRIP_SELECTORS.join(",")).remove()

  const paragraphs: string[] = []
  const seen = new Set<string>()
  body.find("p, li, blockquote, h2, h3").each((_index, element) => {
    const text = cleanText($(element).text())
    if (!text) return
    if (text.length < 30) return
    if (/^source\s*:/i.test(text) || /^©/.test(text)) return
    if (seen.has(text)) return
    seen.add(text)
    paragraphs.push(text)
  })

  const imageUrl = ogImage ?? firstImageFromHtml(body.html() ?? "")
  const text = paragraphs.join("\n\n").slice(0, MAX_ARTICLE_CHARS)

  if (text.length < MIN_ARTICLE_CHARS || paragraphs.length < 2) {
    return { ok: false, error: "insufficient_article_text" }
  }

  return { ok: true, data: { url, title, imageUrl, paragraphs, text } }
}

function normalizeTitle(value: string | undefined): string {
  return value ? cleanText(value) : ""
}

/** Fetch an ANN article page and extract body text + og:image. Never throws. */
export async function fetchArticle(url: string): Promise<FetchResult<ArticleContent>> {
  const target = normalizeUrl(url)
  if (!target) return { ok: false, error: "invalid_article_url" }

  let response: Response
  try {
    response = await fetch(target, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xhtml+xml" },
      cache: "no-store",
      signal: AbortSignal.timeout(ARTICLE_TIMEOUT_MS),
    })
  } catch (error) {
    return { ok: false, error: `article_fetch_failed: ${describeError(error)}` }
  }

  if (!response.ok) return { ok: false, error: `article_http_${response.status}` }

  const contentType = response.headers.get("content-type") ?? ""
  if (contentType && !contentType.includes("html")) {
    return { ok: false, error: `article_unexpected_content_type: ${contentType}` }
  }

  let html: string
  try {
    html = await response.text()
  } catch (error) {
    return { ok: false, error: `article_read_failed: ${describeError(error)}` }
  }

  return extractArticle(html, target)
}

export function describeError(error: unknown): string {
  if (error instanceof Error) {
    return error.name === "TimeoutError" || error.name === "AbortError" ? "timeout" : error.message
  }
  return String(error)
}
