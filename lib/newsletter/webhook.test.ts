import { describe, expect, it } from "vitest"
import {
  handleBrevoWebhook,
  mapEvent,
  SOFT_BOUNCE_THRESHOLD,
  verifyWebhookRequest,
  type WebhookStore,
} from "./webhook"
import type { SubscriberRow } from "./types"

const SECRET = "whsec_test_value"

function subscriber(overrides: Partial<SubscriberRow> = {}): SubscriberRow {
  return {
    id: 4,
    email: "reader@example.com",
    token: "tok-4",
    status: "active",
    confirmedAt: "2026-10-01T00:00:00.000Z",
    source: "site-form",
    prefs: { news: true, episodes: true, upcoming: true, frequency: "daily" },
    lastIssueId: 12,
    unsubscribedAt: null,
    createdAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  }
}

function makeStore(rows: SubscriberRow[] = [subscriber()]) {
  const events: { key: string; event: string }[] = []
  const statuses: { id: number; status: string }[] = []
  const seen = new Set<string>()

  const store: WebhookStore = {
    getSubscriberByEmail: async (email) => rows.find((row) => row.email === email) ?? null,
    setSubscriberStatus: async (id, status) => {
      statuses.push({ id, status })
      const row = rows.find((candidate) => candidate.id === id)
      if (row) row.status = status as SubscriberRow["status"]
    },
    insertEvent: async (input) => {
      const key = `${input.brevoMessageId}|${input.event}|${input.url ?? ""}`
      if (seen.has(key)) return false
      seen.add(key)
      events.push({ key, event: input.event })
      return true
    },
    countEvents: async (_id, event) => events.filter((entry) => entry.event === event).length,
  }

  return { store, events, statuses }
}

describe("verifyWebhookRequest", () => {
  it("accepts a bearer token", () => {
    expect(verifyWebhookRequest({ authorization: `Bearer ${SECRET}`, secretParam: null, expected: SECRET }).ok).toBe(true)
  })

  it("accepts the query parameter form Brevo's UI can use", () => {
    expect(verifyWebhookRequest({ authorization: null, secretParam: SECRET, expected: SECRET }).ok).toBe(true)
  })

  it("rejects a wrong secret in either form", () => {
    expect(verifyWebhookRequest({ authorization: "Bearer nope", secretParam: null, expected: SECRET }).ok).toBe(false)
    expect(verifyWebhookRequest({ authorization: null, secretParam: "nope", expected: SECRET }).ok).toBe(false)
  })

  it("rejects when no secret is presented", () => {
    const result = verifyWebhookRequest({ authorization: null, secretParam: null, expected: SECRET })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("missing_secret")
  })

  it("refuses to authorise anything when the secret is not configured", () => {
    const result = verifyWebhookRequest({ authorization: `Bearer ${SECRET}`, secretParam: SECRET, expected: null })
    expect(result.ok).toBe(false)
    expect(result.reason).toBe("webhook_secret_not_configured")
  })
})

describe("mapEvent", () => {
  it("maps the Brevo names we act on", () => {
    expect(mapEvent("delivered")?.event).toBe("delivered")
    expect(mapEvent("opened")?.event).toBe("opened")
    expect(mapEvent("click")?.event).toBe("clicked")
    expect(mapEvent("hard_bounce")?.status).toBe("bounced")
    expect(mapEvent("spam")?.status).toBe("complained")
    expect(mapEvent("unsubscribed")?.status).toBe("unsubscribed")
    expect(mapEvent("invalid_email")?.status).toBe("bounced")
    expect(mapEvent("soft_bounce")?.softBounce).toBe(true)
  })

  it("returns null for something it does not know", () => {
    expect(mapEvent("teleported")).toBeNull()
  })
})

describe("handleBrevoWebhook", () => {
  it("stores a delivered event against the subscriber's last issue", async () => {
    const { store, events } = makeStore()
    const summary = await handleBrevoWebhook(
      { event: "delivered", email: "reader@example.com", "message-id": "<m1>", ts: 1_762_662_000 },
      store,
    )

    expect(summary.received).toBe(1)
    expect(summary.stored).toBe(1)
    expect(events[0].event).toBe("delivered")
    expect(summary.statusChanges).toHaveLength(0)
  })

  it("dedupes a retried batch and counts the duplicate", async () => {
    const { store, events } = makeStore()
    const payload = { event: "opened", email: "reader@example.com", "message-id": "<m1>" }

    await handleBrevoWebhook(payload, store)
    const second = await handleBrevoWebhook(payload, store)

    expect(events).toHaveLength(1)
    expect(second.duplicates).toBe(1)
    expect(second.stored).toBe(0)
  })

  it("dedupes click events per URL", async () => {
    const { store, events } = makeStore()
    const base = { event: "click", email: "reader@example.com", "message-id": "<m2>" }

    await handleBrevoWebhook({ ...base, url: "https://otakunaija.name.ng/blog/a" }, store)
    await handleBrevoWebhook({ ...base, url: "https://otakunaija.name.ng/blog/b" }, store)
    const third = await handleBrevoWebhook({ ...base, url: "https://otakunaija.name.ng/blog/a" }, store)

    expect(events).toHaveLength(2)
    expect(third.duplicates).toBe(1)
  })

  it("unsubscribes on the unsubscribe event", async () => {
    const { store, statuses } = makeStore()
    const summary = await handleBrevoWebhook(
      { event: "unsubscribed", email: "reader@example.com", "message-id": "<m3>" },
      store,
    )
    expect(statuses).toEqual([{ id: 4, status: "unsubscribed" }])
    expect(summary.statusChanges[0]).toEqual({ email: "reader@example.com", status: "unsubscribed" })
  })

  it("marks a hard bounce immediately", async () => {
    const { store, statuses } = makeStore()
    await handleBrevoWebhook({ event: "hard_bounce", email: "reader@example.com", "message-id": "<m4>" }, store)
    expect(statuses).toEqual([{ id: 4, status: "bounced" }])
  })

  it("marks invalid_email as bounced", async () => {
    const { store, statuses } = makeStore()
    await handleBrevoWebhook({ event: "invalid_email", email: "reader@example.com", "message-id": "<m5>" }, store)
    expect(statuses).toEqual([{ id: 4, status: "bounced" }])
  })

  it("needs three soft bounces before changing the status", async () => {
    const { store, statuses } = makeStore()

    for (let index = 0; index < SOFT_BOUNCE_THRESHOLD - 1; index += 1) {
      await handleBrevoWebhook(
        { event: "soft_bounce", email: "reader@example.com", "message-id": `<s${index}>` },
        store,
      )
    }
    expect(statuses).toHaveLength(0)

    await handleBrevoWebhook({ event: "soft_bounce", email: "reader@example.com", "message-id": "<s9>" }, store)
    expect(statuses).toEqual([{ id: 4, status: "bounced" }])
  })

  it("treats a complaint as the strongest signal", async () => {
    const { store, statuses } = makeStore([subscriber({ status: "complained" })])
    await handleBrevoWebhook({ event: "unsubscribed", email: "reader@example.com", "message-id": "<m6>" }, store)
    expect(statuses).toHaveLength(0)
  })

  it("handles a batch, tolerating unknown events and unknown addresses", async () => {
    const { store, events } = makeStore()

    const summary = await handleBrevoWebhook(
      [
        { event: "delivered", email: "reader@example.com", "message-id": "<b1>" },
        { event: "something_new", email: "reader@example.com", "message-id": "<b2>" },
        { event: "delivered", email: "ghost@example.com", "message-id": "<b3>" },
      ],
      store,
    )

    expect(summary.received).toBe(3)
    expect(summary.stored).toBe(2)
    expect(summary.ignored).toBe(1)
    expect(summary.unknownEvents).toEqual(["something_new"])
    expect(events.map((entry) => entry.event)).toEqual(["delivered", "delivered"])
  })

  it("survives a payload shape it cannot read", async () => {
    const { store } = makeStore()
    for (const payload of [null, "string", 42, {}, []]) {
      const summary = await handleBrevoWebhook(payload, store)
      expect(summary.received).toBe(0)
    }
  })
})
