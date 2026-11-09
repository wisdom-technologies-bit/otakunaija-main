/**
 * Brevo transactional email client.
 *
 * One POST /v3/smtp/email per chunk, using `messageVersions` so every recipient
 * gets their own unsubscribe and preferences URLs (the token lives inside the
 * HTML, and `params` alone cannot substitute it).
 *
 * Brevo's documented limits, checked against the API reference:
 *   - max 2000 recipients per request, max 99 recipients per message version;
 *   - per-version htmlContent is only honoured when a global htmlContent (or
 *     textContent) is also present, so one is always sent;
 *   - top-level `to` is ignored when messageVersions is present, and we omit it
 *     rather than risk a duplicate delivery.
 * We use 50 recipients per chunk: well inside every limit, and small enough
 * that a failed chunk costs little to retry.
 */

import { BREVO_CHUNK_SIZE, type NewsletterConfig } from "./config"

export const BREVO_ENDPOINT = "https://api.brevo.com/v3/smtp/email"

export type BrevoRecipientMessage = {
  email: string
  name?: string
  html: string
  text: string
  headers: Record<string, string>
  params: Record<string, string>
}

export type BrevoChunkInput = {
  subject: string
  /** Fallback body; required by Brevo for per-version bodies to be honoured. */
  html: string
  text: string
  tags: string[]
  messages: BrevoRecipientMessage[]
}

export type BrevoChunkResult =
  | {
      ok: true
      /** Brevo message ids, positionally aligned with the input messages. */
      messageIds: (string | null)[]
      /** Addresses Brevo accepted in this call. */
      accepted: string[]
    }
  | {
      ok: false
      reason: string
      status: number
      /** True when the caller should stop the run and resume later (429). */
      rateLimited: boolean
      /** True when a single retry is worth it (5xx, network). */
      retryable: boolean
      accepted: string[]
    }

export type BrevoDeps = {
  fetchImpl?: typeof fetch
  sleep?: (ms: number) => Promise<void>
  apiKey?: string
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return Math.max(0, seconds)
  const date = Date.parse(value)
  return Number.isNaN(date) ? null : Math.max(0, Math.round((date - Date.now()) / 1000))
}

function buildBody(config: NewsletterConfig, input: BrevoChunkInput) {
  return {
    sender: { name: config.fromName, email: config.fromEmail },
    ...(config.replyTo ? { replyTo: { email: config.replyTo } } : {}),
    subject: input.subject,
    // Global body: Brevo requires one of these for per-version overrides.
    htmlContent: input.html,
    textContent: input.text,
    tags: input.tags,
    messageVersions: input.messages.map((message) => ({
      to: [{ email: message.email, ...(message.name ? { name: message.name } : {}) }],
      subject: input.subject,
      htmlContent: message.html,
      textContent: message.text,
      headers: message.headers,
      params: message.params,
    })),
  }
}

function resultMessage(html: string, text: string, subject: string, tags: string[]): number {
  return html.length + text.length + subject.length + tags.join("").length
}

export class BrevoClient {
  private readonly config: NewsletterConfig
  private readonly deps: BrevoDeps

  constructor(config: NewsletterConfig, deps: BrevoDeps = {}) {
    this.config = config
    this.deps = deps
  }

  get configured(): boolean {
    return Boolean(this.deps.apiKey ?? this.config.brevoApiKey)
  }

  /** Splits on the conservative chunk size. Exposed for the chunking test. */
  chunks<T>(items: T[]): T[][] {
    const size = BREVO_CHUNK_SIZE
    const out: T[][] = []
    for (let index = 0; index < items.length; index += size) out.push(items.slice(index, index + size))
    return out
  }

  async sendChunk(input: BrevoChunkInput): Promise<BrevoChunkResult> {
    const apiKey = (this.deps.apiKey ?? this.config.brevoApiKey ?? "").trim()
    if (!apiKey) {
      return { ok: false, reason: "brevo_not_configured", status: 0, rateLimited: false, retryable: false, accepted: [] }
    }
    if (!input.messages.length) {
      return { ok: true, messageIds: [], accepted: [] }
    }

    const fetchImpl = this.deps.fetchImpl ?? fetch
    const sleep = this.deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)))
    const body = buildBody(this.config, input)
    const accepted = input.messages.map((message) => message.email)

    const attempt = async (): Promise<
      | { ok: true; messageIds: (string | null)[] }
      | { ok: false; status: number; reason: string; retryAfter: number | null }
    > => {
      try {
        const response = await fetchImpl(BREVO_ENDPOINT, {
          method: "POST",
          headers: {
            "api-key": apiKey,
            "content-type": "application/json",
            accept: "application/json",
          },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(30_000),
        })

        if (!response.ok) {
          const detail = await response.text().catch(() => "")
          return {
            ok: false,
            status: response.status,
            reason: `brevo_http_${response.status}${detail ? `:${detail.slice(0, 180)}` : ""}`,
            retryAfter: parseRetryAfter(response.headers.get("retry-after")),
          }
        }

        const payload = (await response.json().catch(() => null)) as
          | { messageId?: string; messageIds?: string[] }
          | null

        const ids: (string | null)[] = input.messages.map((_message, index) => {
          if (Array.isArray(payload?.messageIds) && payload.messageIds[index]) return payload.messageIds[index]
          if (input.messages.length === 1 && payload?.messageId) return payload.messageId
          return null
        })

        return { ok: true, messageIds: ids }
      } catch (error) {
        const reason = error instanceof Error ? error.message : "request failed"
        return { ok: false, status: 0, reason: `brevo_request_failed:${reason}`, retryAfter: null }
      }
    }

    const first = await attempt()
    if (first.ok) return { ok: true, messageIds: first.messageIds, accepted }

    if (first.status === 429) {
      return { ok: false, reason: first.reason, status: 429, rateLimited: true, retryable: false, accepted: [] }
    }

    const retryable = first.status === 0 || first.status >= 500
    if (!retryable) {
      // 4xx: the request itself is wrong. Retrying only burns quota.
      return { ok: false, reason: first.reason, status: first.status, rateLimited: false, retryable: false, accepted: [] }
    }

    const waitMs = first.retryAfter !== null ? Math.min(first.retryAfter, 15) * 1000 : 2_000
    await sleep(waitMs)

    const second = await attempt()
    if (second.ok) return { ok: true, messageIds: second.messageIds, accepted }

    return {
      ok: false,
      reason: second.reason,
      status: second.status,
      rateLimited: second.status === 429,
      retryable: false,
      accepted: [],
    }
  }

  /**
   * Single-recipient send for confirmation emails, test sends and the admin
   * "send test" button.
   */
  async sendTransactional(input: {
    to: string
    subject: string
    html: string
    text: string
    tags?: string[]
    name?: string
    headers?: Record<string, string>
  }): Promise<BrevoChunkResult> {
    return this.sendChunk({
      subject: input.subject,
      html: input.html,
      text: input.text,
      tags: input.tags ?? [this.config.tag, "transactional"],
      messages: [
        {
          email: input.to,
          name: input.name,
          html: input.html,
          text: input.text,
          headers: input.headers ?? {},
          params: {},
        },
      ],
    })
  }
}

/** Package-size guard so a runaway template cannot be sent. */
export const BREVO_MAX_BODY_BYTES = 5 * 1024 * 1024

export function chunkBodyBytes(input: BrevoChunkInput): number {
  return resultMessage(input.html, input.text, input.subject, input.tags) * 2
}
