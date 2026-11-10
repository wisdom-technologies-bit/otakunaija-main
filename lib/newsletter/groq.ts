/**
 * Groq transport for newsletter copy.
 *
 * Deliberately separate from lib/news/rewrite.ts (that pipeline's retry budget
 * is tuned for bulk article rewriting). Same endpoint and model, one transport
 * retry for 429/5xx, and a hard timeout: a slow model must never hold the cron
 * open.
 */

export const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions"
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b"
const DEFAULT_TIMEOUT_MS = 25_000
const MAX_RETRY_WAIT_SECONDS = 15

export type ChatMessage = { role: "system" | "user"; content: string }

export type GroqCall =
  | { ok: true; content: string }
  | { ok: false; reason: string; status: number }

export type GroqDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  apiKey?: string
  model?: string
  timeoutMs?: number
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

export async function callGroq(messages: ChatMessage[], deps: GroqDeps = {}): Promise<GroqCall> {
  const apiKey = (deps.apiKey ?? process.env.GROQ_API_KEY ?? "").trim()
  if (!apiKey) return { ok: false, reason: "missing_groq_api_key", status: 0 }

  const fetchImpl = deps.fetchImpl ?? fetch
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
  const model = deps.model ?? (process.env.GROQ_MODEL?.trim() || DEFAULT_GROQ_MODEL)
  const timeoutMs = deps.timeoutMs ?? DEFAULT_TIMEOUT_MS

  const attempt = async (): Promise<
    { ok: true; content: string } | { ok: false; reason: string; status: number; retryAfter: number | null }
  > => {
    try {
      const response = await fetchImpl(GROQ_ENDPOINT, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model,
          temperature: 0.6,
          max_tokens: 700,
          response_format: { type: "json_object" },
          messages,
        }),
        signal: AbortSignal.timeout(timeoutMs),
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
      const reason = error instanceof Error ? error.message : "request failed"
      return { ok: false, status: 0, reason: `groq_request_failed:${reason}`, retryAfter: null }
    }
  }

  const first = await attempt()
  if (first.ok) return first

  const transient = first.status === 0 || first.status === 429 || first.status >= 500
  if (!transient) return { ok: false, reason: first.reason, status: first.status }
  if (first.retryAfter !== null && first.retryAfter > MAX_RETRY_WAIT_SECONDS) {
    return { ok: false, reason: `${first.reason}_retry_after_${first.retryAfter}s`, status: first.status }
  }

  await sleep(first.retryAfter !== null ? first.retryAfter * 1000 : 2_000)
  const second = await attempt()
  if (second.ok) return second
  return { ok: false, reason: second.reason, status: second.status }
}
