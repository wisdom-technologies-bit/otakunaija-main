import { describe, expect, it, vi } from "vitest"
import {
  countWords,
  findForbiddenMarker,
  findVerbatimOverlap,
  MAX_EXCERPT_CHARS,
  MAX_TITLE_CHARS,
  parseRewriteJson,
  rewriteArticle,
  validateRewrite,
  type RewrittenArticle,
} from "./rewrite"

const SOURCE_TEXT = `The staff for the Spy×Family anime announced on Sunday that the series is receiving a fourth season as well as a new film in theatres in Japan in 2027. The first season premiered in April 2022 and the second season followed in October 2023, airing for 12 episodes before the third season arrived in 2025. Shueisha publishes the manga in English through MANGA Plus and Viz Media, and the 18th compiled volume shipped on November 4 this year.`

const SOURCE_TITLE = "Spy×Family Anime Gets 4th Season, Theatrical Film in 2027"

/** A genuinely independent rewrite of the source above (140+ words, no reuse). */
const GENUINE: RewrittenArticle = {
  title: "Spy×Family Returns With Season 4 and a 2027 Theatrical Film",
  excerpt: "A fourth television season and a feature film are both in the works for the popular family-spy comedy.",
  content: [
    "A fourth Spy×Family television season is officially in production, and a feature film is also planned for Japanese cinemas during 2027. According to the production staff, both projects were confirmed on Sunday together with a new promotional visual for the upcoming episodes.",
    "The adaptation first reached viewers in spring 2022. A second batch of instalments arrived the following year and ran for a dozen episodes, while a third round landed in 2025, keeping the franchise on air across four consecutive years.",
    "On the publishing side, the original manga is being released in English through two separate digital and print channels. The most recent collected edition, the eighteenth, reached shelves in the first week of November.",
    "The franchise has grown well beyond television, with a theatrical feature already released in Japan and a pair of stage musical adaptations that toured multiple cities. Both musical productions later became available to international audiences through paid streaming with English subtitles.",
  ].join("\n\n"),
  tags: ["spy family", "anime", "season 4", "film"],
  category: "News",
}

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers })
}

function groqReply(article: RewrittenArticle | string) {
  return jsonResponse({
    choices: [{ message: { content: typeof article === "string" ? article : JSON.stringify(article) } }],
  })
}

/** Long, unique filler so validation passes without touching the source. */
function fillerArticle(overrides: Partial<RewrittenArticle> = {}): RewrittenArticle {
  const words = Array.from({ length: 150 }, (_unused, index) => `token${index}`).join(" ")
  return {
    title: "Distinct Headline About Something Else Entirely",
    excerpt: "Short excerpt.",
    content: words,
    tags: ["anime"],
    category: "News",
    ...overrides,
  }
}

describe("findVerbatimOverlap", () => {
  it("rejects a copied run of eight words", () => {
    const output = `Intro text here. ${"the series is receiving a fourth season as well as a new film"} and then our own words follow.`
    // The first offending eight-word run is reported.
    expect(findVerbatimOverlap(SOURCE_TEXT, output)).toBe("the series is receiving a fourth season as")
  })

  it("ignores a run of seven words", () => {
    const output = "the staff for the spy family anime revealed something different"
    expect(findVerbatimOverlap(SOURCE_TEXT, output)).toBeNull()
  })

  it("is punctuation and case insensitive", () => {
    const output = "THE SERIES, is receiving a fourth season; as well as a new film!"
    expect(findVerbatimOverlap(SOURCE_TEXT, output)).not.toBeNull()
  })

  it("passes a genuine rewrite", () => {
    expect(findVerbatimOverlap(SOURCE_TEXT, GENUINE.content)).toBeNull()
  })
})

describe("validateRewrite", () => {
  it("accepts a genuine rewrite", () => {
    expect(validateRewrite({ sourceText: SOURCE_TEXT, sourceTitle: SOURCE_TITLE, article: GENUINE })).toEqual({
      ok: true,
    })
  })

  it("rejects a body shorter than 120 words", () => {
    const result = validateRewrite({
      sourceText: SOURCE_TEXT,
      sourceTitle: SOURCE_TITLE,
      article: { ...GENUINE, content: "Too short to publish as a news story." },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/^too_short:/)
  })

  it.each([
    "As an AI, I cannot verify this.",
    "The original report was rewritten for clarity.",
    "Here is a paraphrase of the announcement.",
    "This is an AI-generated summary.",
  ])("rejects the forbidden marker in %s", (sentence) => {
    const result = validateRewrite({
      sourceText: SOURCE_TEXT,
      sourceTitle: SOURCE_TITLE,
      article: { ...GENUINE, content: `${GENUINE.content}\n\n${sentence}` },
    })
    expect(result.ok).toBe(false)
    if (result.ok) return
    expect(result.reason).toMatch(/^forbidden_marker:/)
  })

  it("rejects a headline copied from the source", () => {
    const result = validateRewrite({
      sourceText: SOURCE_TEXT,
      sourceTitle: SOURCE_TITLE,
      article: { ...GENUINE, title: SOURCE_TITLE },
    })
    expect(result).toEqual({ ok: false, reason: "title_copied_from_source" })
  })
})

describe("countWords / findForbiddenMarker", () => {
  it("counts words without markup noise", () => {
    expect(countWords("## Heading\n\nOne two three.")).toBe(4)
  })

  it("returns the offending marker text", () => {
    expect(findForbiddenMarker("Nothing wrong here")).toBeNull()
    expect(findForbiddenMarker("as an ai model I think")).toBe("as an ai")
  })
})

describe("parseRewriteJson", () => {
  it("parses a plain JSON object", () => {
    const result = parseRewriteJson(JSON.stringify(GENUINE))
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title).toBe(GENUINE.title)
    expect(result.data.category).toBe("News")
    expect(result.data.tags).toEqual(["spy family", "anime", "season 4", "film"])
  })

  it("tolerates markdown fences and surrounding prose", () => {
    const raw = "Sure!\n```json\n" + JSON.stringify(GENUINE) + "\n```"
    expect(parseRewriteJson(raw).ok).toBe(true)
  })

  it("rejects invalid JSON", () => {
    expect(parseRewriteJson("not json at all")).toEqual({ ok: false, reason: "invalid_json" })
    expect(parseRewriteJson("")).toEqual({ ok: false, reason: "empty_model_response" })
  })

  it("rejects missing required fields", () => {
    expect(parseRewriteJson(JSON.stringify({ content: "body only" }))).toEqual({ ok: false, reason: "missing_title" })
    expect(parseRewriteJson(JSON.stringify({ title: "Title only" }))).toEqual({ ok: false, reason: "missing_content" })
    expect(parseRewriteJson(JSON.stringify([1, 2, 3]))).toEqual({ ok: false, reason: "json_not_an_object" })
  })

  it("clips long titles and excerpts, normalises tags and defaults the category", () => {
    const result = parseRewriteJson(
      JSON.stringify({
        title: "T".repeat(150),
        excerpt: "E".repeat(400),
        content: "Body",
        tags: ["#Anime", "anime", " MANGA ", "games", "film", "extra", "ignored"],
      }),
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.data.title.length).toBeLessThanOrEqual(MAX_TITLE_CHARS)
    expect(result.data.excerpt.length).toBeLessThanOrEqual(MAX_EXCERPT_CHARS)
    expect(result.data.tags).toEqual(["anime", "manga", "games", "film", "extra"])
    expect(result.data.category).toBe("News")
  })
})

describe("rewriteArticle with a mocked Groq API", () => {
  const input = { title: SOURCE_TITLE, text: SOURCE_TEXT, url: "https://www.animenewsnetwork.com/news/x/.1", topics: ["Anime"] }

  it("calls Groq in JSON mode with the configured model", async () => {
    const fetchImpl = vi.fn(async () => groqReply(GENUINE)) as unknown as typeof fetch
    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep: async () => {} })

    expect(outcome.ok).toBe(true)
    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer test-key")
    const body = JSON.parse(String(init.body))
    expect(body.model).toBe("llama-3.3-70b-versatile")
    expect(body.temperature).toBe(0.5)
    expect(body.response_format).toEqual({ type: "json_object" })
    expect(body.messages[0].role).toBe("system")
    expect(body.messages[0].content).toContain("news editor")
    expect(body.messages[1].content).toContain(SOURCE_TEXT)
  })

  it("honours GROQ_MODEL when provided", async () => {
    const fetchImpl = vi.fn(async () => groqReply(GENUINE)) as unknown as typeof fetch
    await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep: async () => {}, model: "llama-3.1-8b-instant" })
    const body = JSON.parse(String((fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body))
    expect(body.model).toBe("llama-3.1-8b-instant")
  })

  it("retries once after a 429 and succeeds", async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(groqReply(GENUINE)) as unknown as typeof fetch

    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep })
    expect(outcome.ok).toBe(true)
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2)
    expect(sleep).toHaveBeenCalledWith(0)
  })

  it("defers instead of failing when both attempts are rate limited", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "1" }))
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429, { "retry-after": "1" })) as unknown as typeof fetch

    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep: async () => {} })
    expect(outcome).toEqual({ ok: false, reason: "groq_http_429", deferred: true })
  })

  it("defers without waiting when retry-after exceeds the in-run budget", async () => {
    const sleep = vi.fn(async () => {})
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "rate limited" }, 429, { "retry-after": "120" })) as unknown as typeof fetch

    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.deferred).toBe(true)
    expect(outcome.reason).toContain("retry_after_120s")
    expect(sleep).not.toHaveBeenCalled()
  })

  it("retries once when the first answer is not valid JSON", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(groqReply("I cannot do JSON today"))
      .mockResolvedValueOnce(groqReply(GENUINE)) as unknown as typeof fetch

    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep: async () => {} })
    expect(outcome.ok).toBe(true)
    const calls = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls
    expect(calls).toHaveLength(2)
    const secondSystem = JSON.parse(String(calls[1][1].body)).messages[0].content as string
    expect(secondSystem).toContain("previous answer was rejected")
    expect(secondSystem).toContain("invalid_json")
  })

  it("retries when the answer copies the source, then gives up as failed", async () => {
    const copied = fillerArticle({
      content: `${"the series is receiving a fourth season as well as a new film"} ${Array.from({ length: 140 }, (_u, i) => `token${i}`).join(" ")}`,
    })
    const fetchImpl = vi.fn(async () => groqReply(copied)) as unknown as typeof fetch

    const outcome = await rewriteArticle(input, { apiKey: "test-key", fetchImpl, sleep: async () => {} })
    expect(outcome.ok).toBe(false)
    if (outcome.ok) return
    expect(outcome.deferred).toBe(false)
    expect(outcome.reason).toMatch(/^verbatim_overlap:/)
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(2)
  })

  it("does not call Groq without an API key", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const outcome = await rewriteArticle(input, { apiKey: "", fetchImpl })
    expect(outcome).toEqual({ ok: false, reason: "missing_groq_api_key", deferred: false })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })
})
