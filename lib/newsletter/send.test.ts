import { describe, expect, it, vi } from "vitest"
import { runSend, utcDayStart, unsubscribeHeaders, type SendStore } from "./send"
import { newsletterConfig } from "./config"
import { fixtureContext } from "./fixtures"
import { renderIssue } from "./render"
import type { BrevoChunkResult, BrevoClient } from "./brevo"
import type { IssueRow, RecipientRow } from "./store"

const NOW = new Date("2026-11-09T06:00:00.000Z")
const DAY = "2026-11-09"

const config = newsletterConfig({
  BREVO_API_KEY: "test-key",
  SITE_URL: "https://otakunaija.name.ng",
  NEWSLETTER_POSTAL_ADDRESS: "OtakuNaija, Lagos",
  NEWSLETTER_DAILY_CAP: "250",
})

function issue(overrides: Partial<IssueRow> = {}): IssueRow {
  const ctx = fixtureContext({ layout: "lead-story" })
  return {
    id: 12,
    issueDate: DAY,
    status: "approved",
    layout: "lead-story",
    subject: "Solo Leveling season 3 is confirmed",
    preheader: "Plus 16 new episodes.",
    editorsNote: "Two confirmations landed overnight.",
    htmlSize: null,
    recipients: 0,
    sent: 0,
    failed: 0,
    approvedAt: "2026-11-09T05:35:00.000Z",
    sentAt: null,
    createdAt: "2026-11-09T05:30:00.000Z",
    error: null,
    payload: {
      content: ctx.content,
      copy: ctx.copy,
      variant: ctx.variant,
      postIds: [],
      meta: { layoutReason: "test", copySource: "fixture" },
    },
    ...overrides,
  }
}

function recipient(index: number, overrides: Partial<RecipientRow> = {}): RecipientRow {
  return {
    id: 100 + index,
    email: `reader${index}@example.com`,
    token: `tok-${index}`,
    prefs: { news: true, episodes: true, upcoming: true, frequency: "daily" as const },
    lastSentAt: null,
    ...overrides,
  }
}

function makeStore(options: {
  issue?: IssueRow | null
  recipients?: RecipientRow[]
  paused?: boolean
  sentToday?: number
  weekly?: number
} = {}) {
  const state = {
    issue: options.issue === undefined ? issue() : options.issue,
    recipients: options.recipients ?? [recipient(1), recipient(2), recipient(3)],
    updates: [] as { id: number; patch: Record<string, unknown> }[],
    marked: [] as number[][],
    weekly: options.weekly ?? 0,
  }

  const store: SendStore = {
    getIssueByDate: async (date) => (state.issue && state.issue.issueDate === date ? state.issue : null),
    updateIssue: async (id, patch) => {
      state.updates.push({ id, patch: patch as Record<string, unknown> })
      if (state.issue) state.issue = { ...state.issue, ...(patch as Partial<IssueRow>) }
      return state.issue
    },
    isPaused: async () => options.paused ?? false,
    countSentToday: async () => options.sentToday ?? 0,
    listRecipients: async () => state.recipients,
    markSent: async (ids) => {
      state.marked.push(ids)
    },
    countWeekly: async () => options.weekly ?? 0,
  }

  return { store, state }
}

function brevoOf(result: BrevoChunkResult): BrevoClient {
  return {
    sendChunk: vi.fn(async () => result),
    sendTransactional: vi.fn(),
  } as unknown as BrevoClient
}

const okChunk = (count: number): BrevoChunkResult => ({
  ok: true,
  messageIds: Array.from({ length: count }, () => null),
  accepted: [],
})

describe("utcDayStart", () => {
  it("is midnight UTC, the boundary the cap counts against", () => {
    expect(utcDayStart(NOW).toISOString()).toBe("2026-11-09T00:00:00.000Z")
  })
})

describe("unsubscribeHeaders", () => {
  it("uses the one-click pair", () => {
    const headers = unsubscribeHeaders("https://otakunaija.name.ng/api/newsletter/unsubscribe?token=t")
    expect(headers["List-Unsubscribe"]).toBe("<https://otakunaija.name.ng/api/newsletter/unsubscribe?token=t>")
    expect(headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
  })

  it("has no mailto, because there is no unsubscribe mailbox", () => {
    const headers = unsubscribeHeaders("https://x/y")
    expect(headers["List-Unsubscribe"]).not.toContain("mailto:")
  })
})

describe("runSend", () => {
  it("sends the approved issue and marks it sent", async () => {
    const { store, state } = makeStore()
    const brevo = brevoOf(okChunk(3))

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })

    expect(result.sent).toBe(3)
    expect(result.failed).toBe(0)
    expect(result.status).toBe("sent")
    expect(state.marked[0]).toEqual([101, 102, 103])
    expect(state.updates.at(-1)?.patch).toMatchObject({ status: "sent", sent: 3, failed: 0 })
  })

  it("sends nothing when the issue is not approved", async () => {
    const { store } = makeStore({ issue: issue({ status: "draft" }) })
    const brevo = brevoOf(okChunk(3))

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })
    expect(result.sent).toBe(0)
    expect(result.reason).toContain("not-approved")
    expect((brevo.sendChunk as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })

  it("never sends the same issue twice", async () => {
    const { store } = makeStore({ issue: issue({ status: "sent" }) })
    const brevo = brevoOf(okChunk(3))

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })
    expect(result.sent).toBe(0)
    expect(result.reason).toBe("already-sent")
    expect((brevo.sendChunk as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })

  it("respects the pause switch", async () => {
    const { store } = makeStore({ paused: true })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(3)), dry: false })
    expect(result.paused).toBe(true)
    expect(result.sent).toBe(0)
    expect(result.reason).toBe("paused")
  })

  it("says clearly that Brevo is missing instead of pretending to send", async () => {
    const { store } = makeStore()
    const noKey = newsletterConfig({ BREVO_API_KEY: "" })
    const result = await runSend({ now: NOW, config: noKey, store, brevo: brevoOf(okChunk(0)), dry: false })

    expect(result.sent).toBe(0)
    expect(result.reason).toBe("brevo-not-configured")
    expect(result.error).toContain("BREVO_API_KEY")
  })

  it("does nothing once the daily cap is used up", async () => {
    const { store } = makeStore({ sentToday: 250 })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(3)), dry: false })

    expect(result.reason).toBe("daily-cap-reached")
    expect(result.sent).toBe(0)
    expect(result.capRemaining).toBe(0)
  })

  it("limits with the smaller of the cap and the requested limit", async () => {
    const { store } = makeStore({ sentToday: 248 })
    const listSpy = vi.spyOn(store, "listRecipients")

    await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(0)), dry: false, limit: 10 })
    // 250 - 248 = 2 remaining, so 2 wins over 10.
    expect(listSpy.mock.calls[0][0].limit).toBe(2)
  })

  it("asks for weekly subscribers only on Sundays", async () => {
    const monday = makeStore()
    const mondaySpy = vi.spyOn(monday.store, "listRecipients")
    await runSend({ now: NOW, config, store: monday.store, brevo: brevoOf(okChunk(3)), dry: false })
    expect(mondaySpy.mock.calls[0][0].includeWeekly).toBe(false)
    expect(mondaySpy.mock.calls[0][0].issueStart.toISOString()).toBe("2026-11-09T05:35:00.000Z")

    const sundayNow = new Date("2026-11-15T06:00:00.000Z")
    const sunday = makeStore({
      issue: issue({ issueDate: "2026-11-15", approvedAt: "2026-11-15T05:35:00.000Z" }),
    })
    const sundaySpy = vi.spyOn(sunday.store, "listRecipients")
    await runSend({ now: sundayNow, config, store: sunday.store, brevo: brevoOf(okChunk(3)), dry: false })
    expect(sundaySpy.mock.calls[0][0].includeWeekly).toBe(true)
  })

  it("reports how many weekly subscribers were left out", async () => {
    const { store } = makeStore({ weekly: 7 })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(0)), dry: false })
    expect(result.weeklyExcluded).toBe(7)
  })

  it("writes nothing at all on a dry run", async () => {
    const { store, state } = makeStore()
    const brevo = brevoOf(okChunk(3))

    const result = await runSend({ now: NOW, config, store, brevo, dry: true })

    expect(result.dry).toBe(true)
    expect(result.sent).toBe(0)
    expect(result.remaining).toBe(3)
    expect(state.updates).toHaveLength(0)
    expect(state.marked).toHaveLength(0)
    expect((brevo.sendChunk as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })

  it("stops on a 429 and leaves the rest for the next run", async () => {
    const { store, state } = makeStore()
    const brevo = brevoOf({ ok: false, reason: "brevo_http_429", status: 429, rateLimited: true, retryable: false, accepted: [] })

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })

    expect(result.sent).toBe(0)
    expect(result.status).toBe("sending")
    expect(result.reason).toBe("rate-limited")
    expect(state.marked).toHaveLength(0)
    expect(state.updates.at(-1)?.patch.status).toBe("sending")
  })

  it("marks the issue failed when nothing got through", async () => {
    const { store } = makeStore()
    const brevo = brevoOf({ ok: false, reason: "brevo_http_400", status: 400, rateLimited: false, retryable: false, accepted: [] })

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })
    expect(result.status).toBe("failed")
    expect(result.failed).toBe(3)
  })

  it("chunks in batches of 50 with per-recipient headers", async () => {
    const many = Array.from({ length: 120 }, (_value, index) => recipient(index))
    const { store } = makeStore({ recipients: many })
    const sendChunk = vi.fn(async (input: { messages: { email: string; headers: Record<string, string> }[] }) =>
      okChunk(input.messages.length),
    )
    const brevo = { sendChunk, sendTransactional: vi.fn() } as unknown as BrevoClient

    const result = await runSend({ now: NOW, config, store, brevo, dry: false })

    expect(result.sent).toBe(120)
    expect(sendChunk.mock.calls.map((call) => call[0].messages.length)).toEqual([50, 50, 20])
    const firstMessage = sendChunk.mock.calls[0][0].messages[0]
    expect(firstMessage.headers["List-Unsubscribe"]).toContain("token=tok-0")
    expect(sendChunk.mock.calls[0][0].messages[1].headers["List-Unsubscribe"]).toContain("token=tok-1")
  })

  it("renders once per preferences combination, not per person", async () => {
    const { store } = makeStore({
      recipients: [
        recipient(1),
        recipient(2),
        recipient(3, { prefs: { news: true, episodes: false, upcoming: true, frequency: "daily" } }),
      ],
    })
    const render = vi.fn(renderIssue)

    await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(3)), dry: false, render })

    expect(render).toHaveBeenCalledTimes(2)
  })

  it("substitutes each recipient's own token into their copy", async () => {
    const { store } = makeStore({ recipients: [recipient(1), recipient(2)] })
    const sendChunk = vi.fn(async (input: { messages: { html: string }[] }) => okChunk(input.messages.length))
    const brevo = { sendChunk, sendTransactional: vi.fn() } as unknown as BrevoClient

    await runSend({ now: NOW, config, store, brevo, dry: false })

    const [first, second] = sendChunk.mock.calls[0][0].messages
    expect(first.html).toContain("token=tok-1")
    expect(first.html).not.toContain("token=tok-2")
    expect(second.html).toContain("token=tok-2")
  })

  it("does nothing when there is no issue for today", async () => {
    const { store } = makeStore({ issue: null })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(0)), dry: false })
    expect(result.reason).toBe("no-issue-prepared")
  })

  it("refuses an issue with no stored content", async () => {
    const { store } = makeStore({ issue: issue({ payload: null as never }) })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(0)), dry: false })
    expect(result.reason).toBe("issue-payload-missing")
  })

  it("does not touch subscribers when there is nobody due", async () => {
    const { store, state } = makeStore({ recipients: [] })
    const result = await runSend({ now: NOW, config, store, brevo: brevoOf(okChunk(0)), dry: false })
    expect(result.reason).toBe("no-daily-recipients")
    expect(state.marked).toHaveLength(0)
  })
})
