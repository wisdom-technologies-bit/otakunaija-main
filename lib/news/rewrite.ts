import { describeError } from "./ann"

/**
 * Groq rewrite client.
 *
 * The free tier is rate limited, so this is deliberately conservative: a single
 * transport retry that honours `retry-after`, and any 429/5xx that survives that
 * is reported as `deferred` so a later run picks the row up instead of burning a
 * failure attempt.
 */

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
export const DEFAULT_GROQ_MODEL = "llama-3.3-70b-versatile"

const DEFAULT_TIMEOUT_MS = 30_000
/** Waiting longer than this inside one cron invocation is worse than deferring. */
const MAX_RETRY_WAIT_SECONDS = 20
const DEFAULT_RETRY_WAIT_MS = 3_000

/** A run of this many identical consecutive words counts as copying. */
export const VERBATIM_RUN_LENGTH = 8
export const MIN_CONTENT_WORDS = 120
export const MAX_TITLE_CHARS = 90
export const MAX_EXCERPT_CHARS = 180

export type RewrittenArticle = {
  title: string
  excerpt: string
  content: string
  tags: string[]
  category: string
}

export type RewriteFailure = {
  ok: false
  reason: string
  /** True when a later run should simply try again (rate limit, 5xx). */
  deferred: boolean
}

export type RewriteOutcome = { ok: true; data: RewrittenArticle } | RewriteFailure

export type RewriteInput = {
  title: string
  text: string
  url: string
  topics: string[]
}

export type RewriteDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  apiKey?: string
  model?: string
  timeoutMs?: number
}

const FORBIDDEN_MARKERS: RegExp[] = [
  /\bas an ai\b/i,
  /\bai language model\b/i,
  /\blanguage model\b/i,
  /\brewrit(?:ten|e|ing)\b/i,
  /\bparaphras(?:e|ed|ing)\b/i,
  /\bai[- ]generated\b/i,
]

export function countWords(text: string): number {
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/[#*_>`[\]]/g, " ")
    .split(/\s+/)
    .filter((token) => /[\p{L}\p{N}]/u.test(token)).length
}

/** Lowercase, punctuation-free word tokens (unicode aware). */
export function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .normalize("NFKC")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean)
}

/**
 * Returns the first run of `runLength` consecutive words present in both texts,
 * or null. Pure, so the copy check is unit tested.
 */
export function findVerbatimOverlap(
  sourceText: string,
  outputText: string,
  runLength = VERBATIM_RUN_LENGTH,
): string | null {
  const sourceTokens = tokenize(sourceText)
  const outputTokens = tokenize(outputText)
  if (sourceTokens.length < runLength || outputTokens.length < runLength) return null

  const sourceRuns = new Set<string>()
  for (let index = 0; index + runLength <= sourceTokens.length; index += 1) {
    sourceRuns.add(sourceTokens.slice(index, index + runLength).join(" "))
  }

  for (let index = 0; index + runLength <= outputTokens.length; index += 1) {
    const run = outputTokens.slice(index, index + runLength).join(" ")
    if (sourceRuns.has(run)) return run
  }

  return null
}

export function findForbiddenMarker(text: string): string | null {
  for (const pattern of FORBIDDEN_MARKERS) {
    const match = pattern.exec(text)
    if (match) return match[0]
  }
  return null
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/```$/, "").trim()
  const start = trimmed.indexOf("{")
  const end = trimmed.lastIndexOf("}")
  if (start === -1 || end === -1 || end <= start) return trimmed
  return trimmed.slice(start, end + 1)
}

function clip(text: string, max: number): string {
  const trimmed = text.trim()
  if (trimmed.length <= max) return trimmed
  const cut = trimmed.slice(0, max)
  const lastSpace = cut.lastIndexOf(" ")
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trim()
}

function normalizeTags(value: unknown): string[] {
  const raw = Array.isArray(value) ? value : typeof value === "string" ? value.split(",") : []
  const tags = raw.map((tag) => String(tag).trim().toLowerCase().replace(/^#/, "")).filter(Boolean)
  return Array.from(new Set(tags)).slice(0, 5)
}

/** Parses and shape-checks the model's JSON answer. */
export function parseRewriteJson(
  raw: string,
): { ok: true; data: RewrittenArticle } | { ok: false; reason: string } {
  if (!raw || !raw.trim()) return { ok: false, reason: "empty_model_response" }

  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFences(raw))
  } catch {
    return { ok: false, reason: "invalid_json" }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, reason: "json_not_an_object" }
  }

  const record = parsed as Record<string, unknown>
  const title = typeof record.title === "string" ? record.title.trim() : ""
  const content = typeof record.content === "string" ? record.content.trim() : ""
  const excerpt = typeof record.excerpt === "string" ? record.excerpt.trim() : ""

  if (!title) return { ok: false, reason: "missing_title" }
  if (!content) return { ok: false, reason: "missing_content" }

  const category =
    typeof record.category === "string" && record.category.trim() ? record.category.trim() : "News"

  return {
    ok: true,
    data: {
      title: clip(title, MAX_TITLE_CHARS),
      excerpt: clip(excerpt || content.slice(0, 160), MAX_EXCERPT_CHARS),
      content,
      tags: normalizeTags(record.tags),
      category: /^news$/i.test(category) ? "News" : category,
    },
  }
}

export type RewriteValidationInput = {
  sourceText: string
  sourceTitle: string
  article: RewrittenArticle
}

/** Pure safety gate applied to every rewrite before anything is stored. */
export function validateRewrite(
  input: RewriteValidationInput,
): { ok: true } | { ok: false; reason: string } {
  const { article } = input
  const combined = `${article.title}\n${article.excerpt}\n${article.content}`

  const words = countWords(article.content)
  if (words < MIN_CONTENT_WORDS) {
    return { ok: false, reason: `too_short:${words}_words` }
  }

  const marker = findForbiddenMarker(combined)
  if (marker) return { ok: false, reason: `forbidden_marker:${marker}` }

  if (tokenize(article.title).join(" ") === tokenize(input.sourceTitle).join(" ")) {
    return { ok: false, reason: "title_copied_from_source" }
  }

  const overlap = findVerbatimOverlap(input.sourceText, combined)
  if (overlap) return { ok: false, reason: `verbatim_overlap:${overlap}` }

  return { ok: true }
}

const SYSTEM_PROMPT = `You are a news editor for OtakuNaija, an anime news blog for Nigerian anime fans.
You receive the FACTS of a report published by Anime News Network. Write a NEW article from those facts.

Rules:
- Use only facts present in the source text. Never add facts, names, numbers, dates, rumours or opinions of your own.
- Never invent quotes. If you refer to what someone said, paraphrase it plainly in your own words and attribute it.
- Do not copy the source's sentences, phrasing or paragraph order. Use your own structure and transitions.
- Write your own headline: maximum 90 characters, specific and factual, no clickbait, no questions, no ALL CAPS, no emoji.
- Body length: 200-380 words. Neutral, accurate, professional news tone. Short paragraphs.
- Mention Anime News Network only if the source text itself says ANN reported or announced something.
- Never mention that the text is a rewrite, a summary, or AI-assisted. Never mention AI, models or prompts.

Respond with a single JSON object and nothing else, with exactly these keys:
{"title": string, "excerpt": string, "content": string, "tags": string[], "category": "News"}
- "excerpt": at most 180 characters, plain text.
- "content": Markdown made of short paragraphs only. No headings, images, links, tables or bullet lists.
- "tags": at most 5 lowercase keywords without "#".
- "category": exactly "News".`

function buildMessages(input: RewriteInput, rejection?: string) {
  const topics = input.topics.length ? input.topics.join(", ") : "unspecified"
  const strict = rejection
    ? `\n\nIMPORTANT: your previous answer was rejected (${rejection}). Write a completely new article from scratch. Do not reuse any run of ${VERBATIM_RUN_LENGTH} or more consecutive words from the source, do not reuse the source headline, and keep the body between 200 and 380 words.`
    : ""

  return [
    { role: "system" as const, content: `${SYSTEM_PROMPT}${strict}` },
    {
      role: "user" as const,
      content: `SOURCE TITLE: ${input.title}\nSOURCE URL: ${input.url}\nSOURCE TOPICS: ${topics}\n\nSOURCE TEXT:\n"""\n${input.text}\n"""`,
    },
  ]
}

function parseRetryAfter(headerValue: string | null): number | null {
  if (!headerValue) return null
  const seconds = Number(headerValue)
  if (Number.isFinite(seconds)) return Math.max(0, seconds)
  const date = Date.parse(headerValue)
  if (Number.isNaN(date)) return null
  return Math.max(0, Math.round((date - Date.now()) / 1000))
}

type GroqCall = { ok: true; content: string } | { ok: false; reason: string; deferred: boolean }

async function callGroq(
  messages: ReturnType<typeof buildMessages>,
  deps: { fetchImpl: typeof fetch; sleep: (ms: number) => Promise<void>; timeoutMs: number; apiKey: string; model: string },
): Promise<GroqCall> {
  const attempt = async (): Promise<
    | { ok: true; content: string }
    | { ok: false; status: number; reason: string; retryAfter: number | null }
  > => {
    try {
      const response = await deps.fetchImpl(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${deps.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: deps.model,
          temperature: 0.5,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: AbortSignal.timeout(deps.timeoutMs),
      })

      if (!response.ok) {
        return {
          ok: false,
          status: response.status,
          reason: `groq_http_${response.status}`,
          retryAfter: parseRetryAfter(response.headers.get("retry-after")),
        }
      }

      const payload = (await response.json().catch(() => null)) as
        | { choices?: { message?: { content?: string } }[] }
        | null
      const content = payload?.choices?.[0]?.message?.content ?? ""
      if (!content.trim()) return { ok: false, status: 502, reason: "groq_empty_response", retryAfter: null }
      return { ok: true, content }
    } catch (error) {
      return { ok: false, status: 0, reason: `groq_request_failed: ${describeError(error)}`, retryAfter: null }
    }
  }

  const first = await attempt()
  if (first.ok) return { ok: true, content: first.content }

  const transient = first.status === 429 || first.status >= 500 || first.status === 0
  if (!transient) return { ok: false, reason: first.reason, deferred: false }

  if (first.retryAfter !== null && first.retryAfter > MAX_RETRY_WAIT_SECONDS) {
    return { ok: false, reason: `${first.reason}_retry_after_${first.retryAfter}s`, deferred: true }
  }

  await deps.sleep(first.retryAfter !== null ? first.retryAfter * 1000 : DEFAULT_RETRY_WAIT_MS)

  const second = await attempt()
  if (second.ok) return { ok: true, content: second.content }
  if (second.status === 429 || second.status >= 500 || second.status === 0) {
    return { ok: false, reason: second.reason, deferred: true }
  }
  return { ok: false, reason: second.reason, deferred: false }
}

/**
 * Rewrites one ANN article. Retries once on a rejected answer with a stricter
 * instruction; never throws.
 */
export async function rewriteArticle(input: RewriteInput, deps: RewriteDeps = {}): Promise<RewriteOutcome> {
  const apiKey = (deps.apiKey ?? process.env.GROQ_API_KEY ?? "").trim()
  if (!apiKey) return { ok: false, reason: "missing_groq_api_key", deferred: false }

  const resolved = {
    apiKey,
    model: deps.model ?? (process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL),
    fetchImpl: deps.fetchImpl ?? fetch,
    sleep: deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    timeoutMs: deps.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  }

  let rejection: string | undefined

  for (let pass = 0; pass < 2; pass += 1) {
    const call = await callGroq(buildMessages(input, rejection), resolved)
    if (!call.ok) return { ok: false, reason: call.reason, deferred: call.deferred }

    const parsed = parseRewriteJson(call.content)
    if (!parsed.ok) {
      rejection = parsed.reason
      continue
    }

    const validation = validateRewrite({
      sourceText: input.text,
      sourceTitle: input.title,
      article: parsed.data,
    })
    if (validation.ok) return { ok: true, data: parsed.data }

    rejection = validation.reason
  }

  return { ok: false, reason: rejection ?? "rewrite_rejected", deferred: false }
}
