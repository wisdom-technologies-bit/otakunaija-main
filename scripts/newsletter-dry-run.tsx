/**
 * Prints the exact JSON both cron stages return, against the seeded fixture
 * data, with `dry=1`. No database, no Brevo, no network: the same functions the
 * route calls, with the same result objects the route serialises.
 *
 *   npx tsx scripts/newsletter-dry-run.tsx
 *
 * The Brevo key here is a placeholder on purpose: the route's shape for a
 * configured mailbox includes `brevoConfigured: true`, and nothing is sent on a
 * dry run either way.
 */
import { newsletterConfig } from "../lib/newsletter/config"
import { FIXTURE_NOW, FIXTURE_COPY, fixtureSources } from "../lib/newsletter/fixtures"
import { prepareIssue, type PrepareStore } from "../lib/newsletter/prepare"
import { runSend, type SendStore, type RecipientRow } from "../lib/newsletter/send"
import type { BrevoClient } from "../lib/newsletter/brevo"
import type { IssueRow } from "../lib/newsletter/store"

const NOW = new Date("2026-11-09T05:30:00.000Z")

const config = newsletterConfig({
  ...process.env,
  BREVO_API_KEY: "placeholder-key-never-used-on-a-dry-run",
  SITE_URL: "https://otakunaija.name.ng",
  NEWSLETTER_FROM_EMAIL: "press@otakunaija.name.ng",
  NEWSLETTER_FROM_NAME: "OtakuNaija",
  NEWSLETTER_POSTAL_ADDRESS: "OtakuNaija, 12 Adeola Odeku Street, Victoria Island, Lagos, Nigeria",
  NEWSLETTER_MODE: "approve",
  NEWSLETTER_DAILY_CAP: "250",
})

/** An empty newsletter_issues table. */
function emptyStore(): PrepareStore & { inserted: IssueRow[] } {
  const inserted: IssueRow[] = []
  return {
    inserted,
    getIssueByDate: async () => null,
    lastSentIssue: async () => ({
      id: 41,
      issueDate: "2026-11-08",
      status: "sent",
      layout: "roundup",
      subject: "Six episodes, one confirmation",
      preheader: null,
      editorsNote: null,
      htmlSize: 34122,
      recipients: 214,
      sent: 212,
      failed: 2,
      approvedAt: "2026-11-08T05:36:00.000Z",
      sentAt: "2026-11-08T06:04:00.000Z",
      createdAt: "2026-11-08T05:30:00.000Z",
      error: null,
      payload: { postIds: [88, 89] },
    }) as unknown as IssueRow,
    recentIssues: async () => [
      { id: 41, subject: "Six episodes, one confirmation", payload: { postIds: [88, 89] } } as unknown as IssueRow,
      { id: 40, subject: "The Culling Game arc is coming", payload: { postIds: [86] } } as unknown as IssueRow,
      { id: 39, subject: "What to watch this weekend", payload: { postIds: [84] } } as unknown as IssueRow,
    ],
    insertIssue: async (input) => {
      const row = { id: 42, ...input } as unknown as IssueRow
      inserted.push(row)
      return row
    },
  }
}

const recipients: RecipientRow[] = [
  ...Array.from({ length: 5 }, (_v, index) => ({
    id: 501 + index,
    email: `reader${index + 1}@example.com`,
    token: `tok${501 + index}`,
    prefs: { news: true, episodes: true, upcoming: true, frequency: "daily" as const },
    lastSentAt: "2026-11-08T06:00:00.000Z",
  })),
  {
    id: 506,
    email: "weekly1@example.com",
    token: "tok506",
    prefs: { news: true, episodes: true, upcoming: false, frequency: "weekly" as const },
    lastSentAt: "2026-11-02T06:00:00.000Z",
  },
  {
    id: 507,
    email: "weekly2@example.com",
    token: "tok507",
    prefs: { news: false, episodes: true, upcoming: true, frequency: "weekly" as const },
    lastSentAt: null,
  },
]

function sendStore(issue: IssueRow): SendStore {
  return {
    getIssueByDate: async (date) => (date === issue.issueDate ? issue : null),
    updateIssue: async () => issue,
    isPaused: async () => false,
    countSentToday: async () => 137,
    listRecipients: async () =>
      recipients.filter((row) => row.prefs.frequency === "daily"),
    markSent: async () => undefined,
    countWeekly: async () => recipients.filter((row) => row.prefs.frequency === "weekly").length,
  }
}

/** Never called on a dry run; present so the signature is satisfied. */
const brevo = {
  sendChunk: async () => {
    throw new Error("a dry run must not call Brevo")
  },
  sendTransactional: async () => {
    throw new Error("a dry run must not call Brevo")
  },
} as unknown as BrevoClient

async function main() {
  console.log("### GET /api/cron/newsletter?stage=prepare&dry=1\n")
  const store = emptyStore()
  const prepared = await prepareIssue({
    now: NOW,
    config,
    store,
    readSources: async () => fixtureSources(FIXTURE_NOW),
    dry: true,
    logoUrl: null,
    generateCopy: async () => ({
      copy: FIXTURE_COPY,
      reasons: [],
      format: "statement",
      usedModel: false,
      attempts: 0,
      input: undefined as never,
    }),
  })
  console.log(JSON.stringify(prepared, null, 2))
  console.log(`\n(inserts written on a dry run: ${store.inserted.length})`)

  console.log("\n### GET /api/cron/newsletter?stage=send&dry=1\n")
  // The approved issue, as prepare would have written it for the chosen layout.
  const { allLayoutContexts } = await import("../lib/newsletter/fixtures")
  const match = allLayoutContexts().find((entry) => entry.layout === prepared.layout)
  if (!match) throw new Error(`no fixture context for layout ${prepared.layout}`)

  const issue = {
    id: 42,
    issueDate: "2026-11-09",
    status: "approved",
    layout: prepared.layout,
    subject: prepared.subject,
    preheader: prepared.preheader,
    editorsNote: FIXTURE_COPY.editorsNote,
    htmlSize: 34_310,
    recipients: 0,
    sent: 0,
    failed: 0,
    approvedAt: "2026-11-09T05:36:00.000Z",
    sentAt: null,
    createdAt: "2026-11-09T05:30:00.000Z",
    error: null,
    payload: {
      content: match.ctx.content,
      copy: FIXTURE_COPY,
      variant: match.ctx.variant,
      postIds: match.ctx.content.posts.map((post) => post.id),
      meta: { layoutReason: "fixture", copySource: "fixture" },
    },
  } as unknown as IssueRow

  const sent = await runSend({ now: NOW, config, store: sendStore(issue), brevo, dry: true, limit: null })
  console.log(JSON.stringify(sent, null, 2))
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
