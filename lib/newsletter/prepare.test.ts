import { describe, expect, it, vi } from "vitest"
import { prepareIssue, type PrepareStore } from "./prepare"
import { newsletterConfig } from "./config"
import { FIXTURE_COPY, fixtureSources } from "./fixtures"
import { renderIssue } from "./render"
import type { IssueRow } from "./store"

const NOW = new Date("2026-11-09T05:30:00.000Z")

const config = newsletterConfig({
  BREVO_API_KEY: "test-key",
  SITE_URL: "https://otakunaija.name.ng",
  NEWSLETTER_POSTAL_ADDRESS: "OtakuNaija, Lagos",
  NEWSLETTER_MODE: "approve",
})

function makeStore(existing: IssueRow | null = null) {
  const inserts: Record<string, unknown>[] = []
  const store: PrepareStore = {
    getIssueByDate: async () => existing,
    lastSentIssue: async () => ({
      id: 11,
      issueDate: "2026-11-08",
      status: "sent",
      layout: "roundup",
      subject: "Yesterday",
      preheader: null,
      editorsNote: null,
      htmlSize: null,
      recipients: 10,
      sent: 10,
      failed: 0,
      approvedAt: "2026-11-08T05:35:00.000Z",
      sentAt: "2026-11-08T06:10:00.000Z",
      createdAt: "2026-11-08T05:30:00.000Z",
      error: null,
      payload: { content: null as never, copy: FIXTURE_COPY, variant: null as never, postIds: [101] },
    }),
    recentIssues: async () => [
      { payload: { postIds: [101] } } as unknown as IssueRow,
      { payload: { postIds: [102] } } as unknown as IssueRow,
    ],
    insertIssue: async (input) => {
      inserts.push(input as unknown as Record<string, unknown>)
      return { id: 12, ...input } as unknown as IssueRow
    },
  }
  return { store, inserts }
}

function deps(store: PrepareStore, overrides: Partial<Parameters<typeof prepareIssue>[0]> = {}) {
  return {
    now: NOW,
    config,
    store,
    readSources: async () => fixtureSources(NOW),
    dry: true,
    logoUrl: null,
    ...overrides,
  }
}

describe("prepareIssue", () => {
  it("builds today's issue as a draft and stores the content ids", async () => {
    const { store, inserts } = makeStore()
    const result = await prepareIssue(deps(store, { dry: false, generateCopy: undefined }))

    expect(result.issueDate).toBe("2026-11-09")
    expect(result.skipped).toBe(false)
    expect(result.layout).not.toBeNull()
    expect((result.subject ?? "").length).toBeGreaterThan(0)
    expect(inserts).toHaveLength(1)

    const payload = inserts[0].payload as { postIds: number[]; content: unknown }
    expect(Array.isArray(payload.postIds)).toBe(true)
    expect(payload.content).toBeTruthy()
    // The payload keeps ids and slugs only: no rendered HTML.
    expect(JSON.stringify(payload)).not.toContain("<table")
    expect(inserts[0].status).toBe("draft")
  })

  it("is idempotent: a second run for the same day stores nothing new", async () => {
    const existing = {
      id: 12,
      issueDate: "2026-11-09",
      status: "draft",
      layout: "lead-story",
      subject: "Already prepared",
      preheader: "p",
      editorsNote: "n",
      payload: { content: null as never, copy: FIXTURE_COPY, variant: null as never, postIds: [] },
      htmlSize: 20_000,
      recipients: 0,
      sent: 0,
      failed: 0,
    } as unknown as IssueRow

    const { store, inserts } = makeStore(existing)
    const result = await prepareIssue(deps(store, { dry: false }))

    expect(inserts).toHaveLength(0)
    expect(result.issueDate).toBe("2026-11-09")
    expect(result.subject).toBe("Already prepared")
    expect(result.status).toBe("draft")
    expect(result.warning).toContain("already exists")
  })

  it("returns what it would do on a dry run without writing", async () => {
    const { store, inserts } = makeStore()
    const result = await prepareIssue(deps(store))

    expect(result.dry).toBe(true)
    expect(inserts).toHaveLength(0)
    expect(result.layout).not.toBeNull()
    expect(result.items.posts).toBeGreaterThan(0)
    expect(result.copySource).toBe("fallback")
    expect(result.htmlKb).toBeGreaterThan(0)
  })

  it("records a skip instead of an empty email", async () => {
    const { store, inserts } = makeStore()
    const sources = fixtureSources(NOW)
    sources.posts = []
    sources.episodes = []
    sources.airing = []
    sources.upcoming = []

    const result = await prepareIssue(deps(store, { dry: false, readSources: async () => sources }))

    expect(result.skipped).toBe(true)
    expect(result.reason).toBeTruthy()
    expect(inserts[0].status).toBe("skipped")
  })

  it("does not insert twice on a repeated dry run", async () => {
    const { store, inserts } = makeStore()
    await prepareIssue(deps(store))
    await prepareIssue(deps(store))
    expect(inserts).toHaveLength(0)
  })

  it("marks the issue approved in auto mode", async () => {
    const { store, inserts } = makeStore()
    const auto = newsletterConfig({ BREVO_API_KEY: "k", NEWSLETTER_MODE: "auto" })

    await prepareIssue(deps(store, { dry: false, config: auto }))
    // approved_at is written by the store for an approved status.
    expect(inserts[0].status).toBe("approved")
  })

  it("uses the model copy when it is available", async () => {
    const { store, inserts } = makeStore()
    const generateCopy = vi.fn(async (input: { layout: string; seed: number }) => ({
      copy: { ...FIXTURE_COPY, subject: "Solo Leveling season 3 is confirmed" },
      reasons: [] as string[],
      format: "statement" as const,
      usedModel: true,
      attempts: 1,
      input,
    }))

    const result = await prepareIssue(deps(store, { dry: false, generateCopy: generateCopy as never }))

    expect(result.copySource).toBe("groq")
    expect(generateCopy).toHaveBeenCalledOnce()
    expect(inserts[0].subject).toBe("Solo Leveling season 3 is confirmed")
  })

  it("excludes posts from the last three issues", async () => {
    const { store, inserts } = makeStore()
    await prepareIssue(deps(store, { dry: false }))

    const payload = inserts[0].payload as { postIds: number[] }
    expect(payload.postIds).not.toContain(101)
    expect(payload.postIds).not.toContain(102)
  })

  it("measures the HTML it will send", async () => {
    const { store, inserts } = makeStore()
    const result = await prepareIssue(deps(store, { dry: false, render: renderIssue }))

    expect(typeof inserts[0].htmlSize).toBe("number")
    expect(inserts[0].htmlSize).toBeGreaterThan(2_000)
    expect(result.htmlKb).toBeLessThan(90)
  })

  it("warns when Brevo is missing but still prepares the issue", async () => {
    const { store } = makeStore()
    const result = await prepareIssue(
      deps(store, { config: newsletterConfig({ BREVO_API_KEY: "" }) }),
    )
    expect(result.warning).toContain("BREVO_API_KEY")
  })
})
