import { describe, expect, it, vi } from "vitest"
import {
  confirmSubscription,
  looksLikeToken,
  MESSAGES,
  normaliseEmail,
  subscribe,
  unsubscribeByToken,
  updatePreferencesByToken,
  type SubscribeStore,
} from "./subscribe"
import { createRateLimiter } from "./rate-limit"
import type { NewsletterPrefs, SubscriberRow } from "./types"

const NOW = new Date("2026-11-09T06:00:00.000Z")

function subscriber(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    id: 1,
    email: "reader@example.com",
    token: "tok-1",
    status: "active",
    confirmedAt: "2026-10-01T00:00:00.000Z",
    source: "site-form",
    prefs: { news: true, episodes: true, upcoming: true, frequency: "daily" },
    lastIssueId: null,
    unsubscribedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeStore(existing: SubscriberRow | null) {
  const state = {
    existing,
    inserted: [] as { email: string; source: string }[],
    pending: [] as number[],
    confirmed: [] as number[],
    unsubscribed: [] as { id: number; reason: string | null }[],
    prefs: [] as NewsletterPrefs[],
  }

  const store: SubscribeStore = {
    getByEmail: async () => state.existing,
    getByToken: async (token: string) => (state.existing && state.existing.token === token ? state.existing : null),
    insert: async (email, source) => {
      state.inserted.push({ email, source })
      return subscriber({ id: 9, email, token: "tok-new", status: "pending", confirmedAt: null })
    },
    setPending: async (id) => {
      state.pending.push(id)
    },
    confirm: async (id) => {
      state.confirmed.push(id)
    },
    unsubscribe: async (id, _at, reason) => {
      state.unsubscribed.push({ id, reason })
    },
    updatePrefs: async (id, prefs) => {
      state.prefs.push(prefs)
    },
  }

  return { store, state }
}

function deps(store: SubscribeStore, sendResult: { ok: boolean; reason?: string } = { ok: true }) {
  const sendConfirmation = vi.fn(async () => sendResult)
  return { store, sendConfirmation, limiter: createRateLimiter({ limit: 5, windowMs: 3_600_000 }), now: NOW }
}

describe("normaliseEmail", () => {
  it("lowercases and trims", () => {
    expect(normaliseEmail("  Reader@Example.COM ")).toBe("reader@example.com")
  })

  it("rejects obvious junk", () => {
    expect(normaliseEmail("")).toBeNull()
    expect(normaliseEmail("nope")).toBeNull()
    expect(normaliseEmail("a@b")).toBeNull()
    expect(normaliseEmail("a b@c.com")).toBeNull()
    expect(normaliseEmail(`${"a".repeat(250)}@b.com`)).toBeNull()
  })
})

describe("subscribe", () => {
  it("sends a confirmation to a brand new address and stores it as pending", async () => {
    const { store, state } = makeStore(null)
    const d = deps(store)

    const result = await subscribe({ email: "New@Example.com", ip: "1.2.3.4" }, d)

    expect(result.outcome).toBe("pending")
    expect(result.ok).toBe(true)
    expect(state.inserted).toEqual([{ email: "new@example.com", source: "signup" }])
    expect(d.sendConfirmation).toHaveBeenCalledWith({ email: "new@example.com", token: "tok-new" })
  })

  it("says nothing revealing to an address that is already active", async () => {
    const { store } = makeStore(subscriber({ status: "active" }))
    const d = deps(store)

    const result = await subscribe({ email: "reader@example.com", ip: "1.2.3.4" }, d)
    expect(result.outcome).toBe("active")
    expect(result.message).toBe(MESSAGES.alreadyActive)
    expect(d.sendConfirmation).not.toHaveBeenCalled()
  })

  it("re-sends the confirmation after an unsubscribe, and stores pending again", async () => {
    const { store, state } = makeStore(subscriber({ status: "unsubscribed" }))
    const d = deps(store)

    const result = await subscribe({ email: "reader@example.com", ip: "1.2.3.4" }, d)
    expect(result.outcome).toBe("pending")
    expect(state.pending).toEqual([1])
    expect(d.sendConfirmation).toHaveBeenCalled()
  })

  it("sends nothing to a bounced or complaining address, and does not say why", async () => {
    for (const status of ["bounced", "complained"] as const) {
      const { store } = makeStore(subscriber({ status }))
      const d = deps(store)

      const result = await subscribe({ email: "reader@example.com", ip: "1.2.3.4" }, d)
      expect(result.outcome).toBe("suppressed")
      expect(result.ok).toBe(true)
      expect(result.message).toBe(MESSAGES.neutral)
      expect(d.sendConfirmation).not.toHaveBeenCalled()
    }
  })

  it("ignores a filled honeypot entirely", async () => {
    const { store, state } = makeStore(null)
    const d = deps(store)

    const result = await subscribe({ email: "bot@example.com", honeypot: "http://spam" }, d)
    expect(result.outcome).toBe("honeypot")
    expect(state.inserted).toHaveLength(0)
    expect(d.sendConfirmation).not.toHaveBeenCalled()
  })

  it("stops after five attempts from one address per hour", async () => {
    const { store } = makeStore(null)
    const d = deps(store)

    for (let index = 0; index < 5; index += 1) {
      const result = await subscribe({ email: `a${index}@example.com`, ip: "9.9.9.9" }, d)
      expect(result.outcome).toBe("pending")
    }
    const blocked = await subscribe({ email: "a6@example.com", ip: "9.9.9.9" }, d)
    expect(blocked.outcome).toBe("rate-limited")
    expect(blocked.ok).toBe(false)
  })

  it("reports a delivery failure without pretending the address is confirmed", async () => {
    const { store } = makeStore(null)
    const d = deps(store, { ok: false, reason: "brevo_not_configured" })

    const result = await subscribe({ email: "new@example.com", ip: "1.2.3.4" }, d)
    expect(result.ok).toBe(false)
    expect(result.outcome).toBe("error")
  })

  it("rejects an invalid address before touching the database", async () => {
    const { store, state } = makeStore(null)
    const d = deps(store)

    const result = await subscribe({ email: "not-an-email", ip: "1.2.3.4" }, d)
    expect(result.outcome).toBe("invalid")
    expect(state.inserted).toHaveLength(0)
  })
})

describe("token pages", () => {
  it("recognises a plausible token and rejects junk", () => {
    expect(looksLikeToken("a".repeat(32))).toBe(true)
    expect(looksLikeToken("")).toBe(false)
    expect(looksLikeToken(null)).toBe(false)
    expect(looksLikeToken("short")).toBe(false)
  })

  it("confirms an active subscription", async () => {
    const { store, state } = makeStore(subscriber({ status: "pending", confirmedAt: null }))
    const result = await confirmSubscription("tok-1", { store, now: NOW })

    expect(result.ok).toBe(true)
    expect(state.confirmed).toEqual([1])
  })

  it("is idempotent: confirming twice keeps the success message", async () => {
    const { store, state } = makeStore(subscriber({ status: "active" }))
    const result = await confirmSubscription("tok-1", { store, now: NOW })

    expect(result.ok).toBe(true)
    expect(state.confirmed).toHaveLength(0)
  })

  it("fails a bad token with a friendly message", async () => {
    const { store } = makeStore(null)
    const result = await confirmSubscription("nothing-here", { store, now: NOW })

    expect(result.ok).toBe(false)
    expect(result.message).toContain("link")
  })

  it("unsubscribes, records the reason, and is idempotent", async () => {
    const { store, state } = makeStore(subscriber({ status: "active" }))

    const first = await unsubscribeByToken("tok-1", "too many emails", { store, now: NOW })
    expect(first.ok).toBe(true)
    expect(state.unsubscribed).toEqual([{ id: 1, reason: "too many emails" }])

    state.existing = subscriber({ status: "unsubscribed", unsubscribedAt: NOW.toISOString() })
    const second = await unsubscribeByToken("tok-1", null, { store, now: NOW })
    expect(second.ok).toBe(true)
    expect(state.unsubscribed).toHaveLength(1)
  })

  it("rejects an invalid unsubscribe token", async () => {
    const { store } = makeStore(null)
    const result = await unsubscribeByToken("bad", null, { store, now: NOW })
    expect(result.ok).toBe(false)
  })

  it("saves preferences including the weekly cadence", async () => {
    const { store, state } = makeStore(subscriber())
    const prefs: NewsletterPrefs = { news: false, episodes: true, upcoming: true, frequency: "weekly" }

    const result = await updatePreferencesByToken("tok-1", prefs, { store })
    expect(result.ok).toBe(true)
    expect(state.prefs.at(-1)).toEqual(prefs)
  })

  it("refuses to save preferences for a bad token", async () => {
    const { store } = makeStore(null)
    const result = await updatePreferencesByToken("bad", { news: true, episodes: true, upcoming: true, frequency: "daily" }, { store })
    expect(result.ok).toBe(false)
  })
})
