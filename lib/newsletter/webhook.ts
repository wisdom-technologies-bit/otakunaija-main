/**
 * Brevo webhook handling.
 *
 * Brevo posts event batches; we accept one object or an array, ignore events we
 * do not recognise, and dedupe on (message id, event, url) so a retried batch
 * cannot double-count an open.
 *
 * The subscriber is resolved by address (every Brevo event carries `email`),
 * and the issue is taken from that subscriber's `last_issue_id`, which is the
 * issue they were most recently sent.
 */

import { createHash, timingSafeEqual } from "node:crypto"
import type { SubscriberRow } from "./types"

export type BrevoWebhookEvent = {
  event?: string
  email?: string
  id?: number | string
  "message-id"?: string
  messageId?: string
  ts?: number | string
  ts_epoch?: number | string
  url?: string
  link?: string
  reason?: string
  tag?: string
}

export type WebhookStore = {
  getSubscriberByEmail(email: string): Promise<SubscriberRow | null>
  setSubscriberStatus(id: number, status: string): Promise<void>
  insertEvent(input: {
    issueId: number | null
    subscriberId: number | null
    event: string
    url: string | null
    occurredAt: string | null
    brevoMessageId: string | null
  }): Promise<boolean>
  countEvents(subscriberId: number, event: string): Promise<number>
}

export type WebhookSummary = {
  received: number
  stored: number
  duplicates: number
  ignored: number
  statusChanges: { email: string; status: string }[]
  unknownEvents: string[]
}

/** Soft bounces are only a hard failure on the third one. */
export const SOFT_BOUNCE_THRESHOLD = 3

type Mapped = {
  /** Stored event name. */
  event: string
  /** Subscriber status this event forces, if any. */
  status?: "bounced" | "complained" | "unsubscribed"
  /** Counts towards the soft-bounce threshold. */
  softBounce?: boolean
}

export function mapEvent(raw: string): Mapped | null {
  const name = raw.trim().toLowerCase()
  switch (name) {
    case "delivered":
    case "request":
      return { event: "delivered" }
    case "opened":
    case "unique_opened":
    case "proxy_open":
      return { event: "opened" }
    case "click":
    case "clicked":
      return { event: "clicked" }
    case "hard_bounce":
    case "hardbounce":
      return { event: "bounced", status: "bounced" }
    case "soft_bounce":
    case "softbounce":
      return { event: "soft_bounce", softBounce: true }
    case "spam":
    case "complaint":
    case "complained":
      return { event: "complained", status: "complained" }
    case "unsubscribed":
    case "unsubscribe":
      return { event: "unsubscribed", status: "unsubscribed" }
    case "blocked":
      return { event: "blocked" }
    case "invalid_email":
    case "invalid":
      return { event: "invalid", status: "bounced" }
    case "deferred":
      return { event: "deferred" }
    default:
      return null
  }
}

function occurredAt(event: BrevoWebhookEvent): string | null {
  const raw = event.ts ?? event.ts_epoch
  if (raw === undefined || raw === null || raw === "") return null
  const numeric = Number(raw)
  if (Number.isFinite(numeric)) {
    // Brevo sends seconds; tolerate milliseconds too.
    const ms = numeric > 1e12 ? numeric : numeric * 1000
    const date = new Date(ms)
    return Number.isNaN(date.getTime()) ? null : date.toISOString()
  }
  const parsed = new Date(String(raw))
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString()
}

function messageId(event: BrevoWebhookEvent): string | null {
  const value = event["message-id"] ?? event.messageId ?? (event.id !== undefined ? String(event.id) : null)
  return value ? String(value) : null
}

function eventUrl(event: BrevoWebhookEvent): string | null {
  const value = event.url ?? event.link
  return value ? String(value).slice(0, 2000) : null
}

/** An "event" is only an event if it names one; anything else is noise. */
function isEvent(item: unknown): item is BrevoWebhookEvent {
  if (!item || typeof item !== "object") return false
  const name = (item as BrevoWebhookEvent).event
  return typeof name === "string" && name.trim().length > 0
}

function asArray(payload: unknown): BrevoWebhookEvent[] {
  if (Array.isArray(payload)) return payload.filter(isEvent)
  if (isEvent(payload)) return [payload]
  return []
}

export async function handleBrevoWebhook(payload: unknown, store: WebhookStore): Promise<WebhookSummary> {
  const events = asArray(payload)
  const summary: WebhookSummary = {
    received: events.length,
    stored: 0,
    duplicates: 0,
    ignored: 0,
    statusChanges: [],
    unknownEvents: [],
  }

  for (const event of events) {
    const rawName = String(event.event ?? "").trim()
    const mapped = rawName ? mapEvent(rawName) : null
    if (!mapped) {
      summary.ignored += 1
      if (rawName && !summary.unknownEvents.includes(rawName)) summary.unknownEvents.push(rawName)
      continue
    }

    const email = String(event.email ?? "").trim().toLowerCase()
    const subscriber = email ? await store.getSubscriberByEmail(email) : null
    const url = eventUrl(event)
    const inserted = await store.insertEvent({
      issueId: subscriber?.lastIssueId ?? null,
      subscriberId: subscriber?.id ?? null,
      event: mapped.event,
      url,
      occurredAt: occurredAt(event),
      brevoMessageId: messageId(event),
    })

    if (!inserted) {
      summary.duplicates += 1
      continue
    }
    summary.stored += 1

    if (!subscriber) continue

    if (mapped.softBounce) {
      const count = await store.countEvents(subscriber.id, "soft_bounce")
      if (count >= SOFT_BOUNCE_THRESHOLD && subscriber.status !== "bounced") {
        await store.setSubscriberStatus(subscriber.id, "bounced")
        summary.statusChanges.push({ email: subscriber.email, status: "bounced" })
      }
      continue
    }

    if (mapped.status && subscriber.status !== mapped.status) {
      // A complaint or bounce outranks an unsubscribe flag; never downgrade it.
      if (subscriber.status === "complained" && mapped.status !== "complained") continue
      await store.setSubscriberStatus(subscriber.id, mapped.status)
      summary.statusChanges.push({ email: subscriber.email, status: mapped.status })
    }
  }

  return summary
}

// ---------------------------------------------------------------------------
// Authentication
// ---------------------------------------------------------------------------

function constantTimeEqual(a: string, b: string): boolean {
  const left = createHash("sha256").update(a).digest()
  const right = createHash("sha256").update(b).digest()
  return timingSafeEqual(left, right)
}

/**
 * Accepts `Authorization: Bearer <secret>` or `?secret=<secret>`. Brevo's
 * webhook UI only offers a URL, which is why the query parameter exists.
 */
export function verifyWebhookRequest(input: {
  authorization: string | null
  secretParam: string | null
  expected: string | null
}): { ok: boolean; reason?: string } {
  const expected = input.expected
  if (!expected) return { ok: false, reason: "webhook_secret_not_configured" }

  const header = (input.authorization ?? "").trim()
  const bearer = header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : ""
  const candidates = [bearer, (input.secretParam ?? "").trim()].filter(Boolean)

  if (!candidates.length) return { ok: false, reason: "missing_secret" }
  const matched = candidates.some((candidate) => constantTimeEqual(candidate, expected))
  return matched ? { ok: true } : { ok: false, reason: "invalid_secret" }
}
