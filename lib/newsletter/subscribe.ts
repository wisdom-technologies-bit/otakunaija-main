/**
 * Double opt-in, unsubscribe and preferences, as pure flows with injected
 * dependencies.
 *
 * Every branch below is unit tested without a database or Brevo account, which
 * matters because these are the paths where getting it wrong either spam
 * complaints or silently loses subscribers.
 *
 * Privacy rule: the response never says more than the old form did. An active
 * address gets "already subscribed"; a new, previously-unsubscribed or
 * suppressed address gets the same neutral "check your inbox" line.
 */

import type { RateLimiter } from "./rate-limit"
import { normalisePrefs, type NewsletterPrefs, type SubscriberRow } from "./types"

export const EMAIL_RE = /^[^\s@<>()[\],;:"]+@[^\s@<>()[\],;:"]+\.[a-zA-Z]{2,}$/
export const MAX_EMAIL_LENGTH = 254

export const MESSAGES = {
  confirmSent: "Almost there. Check your inbox and tap the link to confirm.",
  alreadyActive: "You're already subscribed — thanks for sticking around!",
  neutral: "Thanks. If that address can receive our emails, a confirmation is on its way.",
  invalid: "Please enter a valid email address.",
  rateLimited: "Too many attempts from this connection. Try again in an hour.",
  error: "Something went wrong. Try again in a moment.",
} as const

export type SubscribeOutcome =
  | "pending"
  | "resent"
  | "active"
  | "suppressed"
  | "honeypot"
  | "invalid"
  | "rate-limited"
  | "error"

export type SubscribeResult = {
  ok: boolean
  message: string
  outcome: SubscribeOutcome
}

/** Minimal store surface; the SQL implementation lives in store.ts. */
export type SubscribeStore = {
  getByEmail(email: string): Promise<SubscriberRow | null>
  getByToken(token: string): Promise<SubscriberRow | null>
  insert(email: string, source: string): Promise<SubscriberRow>
  setPending(id: number, options: { source: string }): Promise<void>
  confirm(id: number, at: Date): Promise<void>
  unsubscribe(id: number, at: Date, reason: string | null): Promise<void>
  updatePrefs(id: number, prefs: NewsletterPrefs): Promise<void>
}

export type SubscribeDeps = {
  store: SubscribeStore
  sendConfirmation: (args: { email: string; token: string }) => Promise<{ ok: boolean; reason?: string }>
  limiter: RateLimiter
  now: Date
}

export type SubscribeInput = {
  email: string
  /** Hidden field: a real person leaves it empty. */
  honeypot?: string | null
  /** Used as the rate-limit key; falls back to the address itself. */
  ip?: string | null
  source?: string
}

export function normaliseEmail(raw: string): string | null {
  const value = (raw ?? "").trim().toLowerCase()
  if (!value || value.length > MAX_EMAIL_LENGTH) return null
  if (!EMAIL_RE.test(value)) return null
  return value
}

export async function subscribe(input: SubscribeInput, deps: SubscribeDeps): Promise<SubscribeResult> {
  // Bots fill hidden fields. Pretend it worked; do nothing.
  if ((input.honeypot ?? "").trim().length > 0) {
    return { ok: true, message: MESSAGES.neutral, outcome: "honeypot" }
  }

  const email = normaliseEmail(input.email)
  if (!email) return { ok: false, message: MESSAGES.invalid, outcome: "invalid" }

  const key = (input.ip ?? "").trim() || `email:${email}`
  if (!deps.limiter.attempt(key, deps.now)) {
    return { ok: false, message: MESSAGES.rateLimited, outcome: "rate-limited" }
  }

  const source = input.source ?? "signup"

  try {
    const existing = await deps.store.getByEmail(email)

    if (!existing) {
      const created = await deps.store.insert(email, source)
      const sent = await deps.sendConfirmation({ email, token: created.token })
      if (!sent.ok) {
        // The row stays pending: tapping "resend" or signing up again confirms.
        return { ok: false, message: MESSAGES.error, outcome: "error" }
      }
      return { ok: true, message: MESSAGES.confirmSent, outcome: "pending" }
    }

    if (existing.status === "active") {
      return { ok: true, message: MESSAGES.alreadyActive, outcome: "active" }
    }

    if (existing.status === "pending") {
      const sent = await deps.sendConfirmation({ email, token: existing.token })
      return sent.ok
        ? { ok: true, message: MESSAGES.confirmSent, outcome: "resent" }
        : { ok: false, message: MESSAGES.error, outcome: "error" }
    }

    if (existing.status === "unsubscribed") {
      await deps.store.setPending(existing.id, { source })
      const sent = await deps.sendConfirmation({ email, token: existing.token })
      return sent.ok
        ? { ok: true, message: MESSAGES.confirmSent, outcome: "pending" }
        : { ok: false, message: MESSAGES.error, outcome: "error" }
    }

    // bounced / complained: say nothing useful, send nothing.
    return { ok: true, message: MESSAGES.neutral, outcome: "suppressed" }
  } catch {
    return { ok: false, message: MESSAGES.error, outcome: "error" }
  }
}

export type TokenResult = {
  ok: boolean
  message: string
  subscriber: SubscriberRow | null
}

export async function confirmSubscription(
  token: string,
  deps: { store: SubscribeStore; now: Date },
): Promise<TokenResult> {
  const subscriber = await deps.store.getByToken((token ?? "").trim())
  if (!subscriber) {
    return { ok: false, message: "This link is not valid. It may have expired, or been used already.", subscriber: null }
  }

  if (subscriber.status === "unsubscribed") {
    return {
      ok: false,
      message: "This address was unsubscribed. Sign up again on the site and confirm the new email.",
      subscriber,
    }
  }

  if (subscriber.status === "bounced" || subscriber.status === "complained") {
    return { ok: false, message: "This address cannot receive our emails.", subscriber }
  }

  if (subscriber.status !== "active") {
    await deps.store.confirm(subscriber.id, deps.now)
  }

  return { ok: true, message: "You're confirmed. The next briefing lands tomorrow morning.", subscriber }
}

export async function unsubscribeByToken(
  token: string,
  reason: string | null,
  deps: { store: SubscribeStore; now: Date },
): Promise<TokenResult> {
  const subscriber = await deps.store.getByToken((token ?? "").trim())
  if (!subscriber) {
    return { ok: false, message: "This link is not valid. It may have expired, or been used already.", subscriber: null }
  }

  // Idempotent: unsubscribing twice is a success, not an error.
  if (subscriber.status !== "unsubscribed") {
    await deps.store.unsubscribe(subscriber.id, deps.now, reason?.slice(0, 200) ?? null)
  }

  return { ok: true, message: "You're unsubscribed. No more daily emails from us.", subscriber }
}

export async function updatePreferencesByToken(
  token: string,
  prefs: Partial<NewsletterPrefs>,
  deps: { store: SubscribeStore },
): Promise<TokenResult> {
  const subscriber = await deps.store.getByToken((token ?? "").trim())
  if (!subscriber) {
    return { ok: false, message: "This link is not valid. It may have expired, or been used already.", subscriber: null }
  }

  const merged = normalisePrefs({ ...subscriber.prefs, ...prefs })
  await deps.store.updatePrefs(subscriber.id, merged)
  return { ok: true, message: "Preferences saved.", subscriber: { ...subscriber, prefs: merged } }
}

/** One-click unsubscribe validation: the token must look like a token. */
export function looksLikeToken(token: string | null | undefined): boolean {
  return /^[a-f0-9]{16,64}$/i.test((token ?? "").trim())
}
