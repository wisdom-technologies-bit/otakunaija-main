import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"
import { NextRequest } from "next/server"

// The route modules import the database layer, which refuses to load without a
// URL. Nothing here actually connects: every case below returns before a query.
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:5432/otakunaija_test"

type Handler = (request: NextRequest) => Promise<Response>

let GET: Handler
let POST: Handler
let WebhookGet: Handler
let WebhookPost: Handler
let OneClickGet: Handler

beforeAll(async () => {
  const cron = await import("../../app/api/cron/newsletter/route")
  const webhook = await import("../../app/api/webhooks/brevo/route")
  const oneClick = await import("../../app/api/newsletter/unsubscribe/route")
  GET = cron.GET as unknown as Handler
  POST = cron.POST as unknown as Handler
  WebhookGet = webhook.GET as unknown as Handler
  WebhookPost = webhook.POST as unknown as Handler
  OneClickGet = oneClick.GET as unknown as Handler
})

afterAll(() => {
  process.env.DATABASE_URL = undefined
})

const SECRET = "cron_test_secret"

function request(path: string, init: { auth?: string | null } = {}) {
  const headers = new Headers()
  if (init.auth !== null) headers.set("authorization", init.auth ?? `Bearer ${SECRET}`)
  return new NextRequest(`http://localhost${path}`, { headers })
}

const original = { ...process.env }

beforeEach(() => {
  process.env.CRON_SECRET = SECRET
  process.env.BREVO_WEBHOOK_SECRET = "whsec_test"
})

afterEach(() => {
  process.env = { ...original }
})

describe("cron route authentication", () => {
  it("answers 401 with no Authorization header", async () => {
    const response = await GET(request("/api/cron/newsletter?stage=prepare", { auth: null }))
    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({ error: "Unauthorized" })
  })

  it("answers 401 with the wrong bearer token", async () => {
    const response = await GET(request("/api/cron/newsletter?stage=send", { auth: "Bearer nope" }))
    expect(response.status).toBe(401)
  })

  it("answers 401 when CRON_SECRET is not configured", async () => {
    delete process.env.CRON_SECRET
    const response = await POST(request("/api/cron/newsletter?stage=prepare"))
    expect(response.status).toBe(401)
  })
})

describe("cron route validation", () => {
  it("rejects an unknown stage before touching anything", async () => {
    const response = await GET(request("/api/cron/newsletter?stage=whatever"))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("prepare or send")
  })

  it("refuses a single test recipient: that belongs to the admin endpoint", async () => {
    const response = await GET(request("/api/cron/newsletter?stage=prepare&to=someone@example.com"))
    expect(response.status).toBe(400)
    expect((await response.json()).error).toContain("/api/admin/newsletter")
  })
})

describe("brevo webhook route", () => {
  it("answers 401 without a secret", async () => {
    const response = await WebhookPost(
      new NextRequest("http://localhost/api/webhooks/brevo", {
        method: "POST",
        body: JSON.stringify({ event: "delivered", email: "a@b.com" }),
      }),
    )
    expect(response.status).toBe(401)
  })

  it("answers 401 with the wrong secret", async () => {
    const response = await WebhookPost(
      new NextRequest("http://localhost/api/webhooks/brevo?secret=wrong", {
        method: "POST",
        body: JSON.stringify({ event: "delivered", email: "a@b.com" }),
      }),
    )
    expect(response.status).toBe(401)
  })

  it("answers 401 when the webhook secret is not configured at all", async () => {
    delete process.env.BREVO_WEBHOOK_SECRET
    const response = await WebhookGet(new NextRequest("http://localhost/api/webhooks/brevo?secret=anything"))
    expect(response.status).toBe(401)
  })

  it("acknowledges a probe with the right secret", async () => {
    const response = await WebhookGet(new NextRequest("http://localhost/api/webhooks/brevo?secret=whsec_test"))
    expect(response.status).toBe(200)
  })
})

describe("one-click unsubscribe route", () => {
  it("redirects a browser GET to the styled page", async () => {
    const response = await OneClickGet(new NextRequest("http://localhost/api/newsletter/unsubscribe?token=abc"))
    expect(response.status).toBe(302)
    expect(response.headers.get("location")).toContain("/newsletter/unsubscribe?token=abc")
  })
})
