import { describe, expect, it, vi } from "vitest"
import { BrevoClient, BREVO_ENDPOINT, type BrevoChunkInput, type BrevoRecipientMessage } from "./brevo"
import { newsletterConfig } from "./config"

const config = newsletterConfig({
  BREVO_API_KEY: "test-key",
  NEWSLETTER_FROM_EMAIL: "press@otakunaija.name.ng",
  NEWSLETTER_FROM_NAME: "OtakuNaija",
  SITE_URL: "https://otakunaija.name.ng",
  NEWSLETTER_POSTAL_ADDRESS: "OtakuNaija, Lagos",
})

function message(index: number): BrevoRecipientMessage {
  return {
    email: `reader${index}@example.com`,
    html: `<p>issue for ${index}</p>`,
    text: `issue for ${index}`,
    headers: {
      "List-Unsubscribe": `<https://otakunaija.name.ng/api/newsletter/unsubscribe?token=t${index}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
    params: { EMAIL: `reader${index}@example.com` },
  }
}

function chunk(messages: BrevoRecipientMessage[]): BrevoChunkInput {
  return {
    subject: "Solo Leveling season 3 is confirmed",
    html: "<p>global</p>",
    text: "global",
    tags: ["daily-digest", "2026-11-09"],
    messages,
  }
}

function client(impl: typeof fetch, sleep: () => Promise<void> = async () => {}) {
  return new BrevoClient(config, { fetchImpl: impl, sleep, apiKey: "test-key" })
}

const okResponse = () =>
  new Response(JSON.stringify({ messageIds: ["m1", "m2"] }), {
    status: 201,
    headers: { "content-type": "application/json" },
  })

describe("chunking", () => {
  it("splits on the conservative chunk size", () => {
    const instance = new BrevoClient(config)
    const chunks = instance.chunks(Array.from({ length: 120 }, (_value, index) => index))
    expect(chunks.map((group) => group.length)).toEqual([50, 50, 20])
  })

  it("never exceeds the documented per-call ceiling", () => {
    const chunks = new BrevoClient(config).chunks(Array.from({ length: 250 }, (_value, index) => index))
    for (const group of chunks) expect(group.length).toBeLessThanOrEqual(50)
  })
})

describe("sendChunk", () => {
  it("posts a messageVersion per recipient with their own headers and params", async () => {
    const fetchImpl = vi.fn(async () => okResponse()) as unknown as typeof fetch
    const result = await client(fetchImpl).sendChunk(chunk([message(1), message(2)]))

    expect(result.ok).toBe(true)

    const [url, init] = (fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0]
    expect(url).toBe(BREVO_ENDPOINT)
    expect((init.headers as Record<string, string>)["api-key"]).toBe("test-key")

    const body = JSON.parse(String(init.body)) as {
      sender: { email: string; name: string }
      tags: string[]
      messageVersions: {
        to: { email: string }[]
        htmlContent: string
        headers: Record<string, string>
        params: Record<string, string>
      }[]
      htmlContent: string
      textContent: string
    }

    expect(body.sender.email).toBe("press@otakunaija.name.ng")
    expect(body.tags).toEqual(["daily-digest", "2026-11-09"])
    expect(body.messageVersions).toHaveLength(2)
    expect(body.messageVersions[0].to[0].email).toBe("reader1@example.com")
    expect(body.messageVersions[1].to[0].email).toBe("reader2@example.com")
    expect(body.messageVersions[0].htmlContent).toBe("<p>issue for 1</p>")
    expect(body.messageVersions[1].htmlContent).toBe("<p>issue for 2</p>")
    expect(body.messageVersions[0].headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click")
    expect(body.messageVersions[0].headers["List-Unsubscribe"]).toContain("token=t1")
    expect(body.messageVersions[1].params.EMAIL).toBe("reader2@example.com")
    // A global body is required for per-version overrides to be honoured.
    expect(body.htmlContent.length).toBeGreaterThan(0)
    expect(body.textContent.length).toBeGreaterThan(0)
  })

  it("accepts a missing body without calling Brevo", async () => {
    const fetchImpl = vi.fn() as unknown as typeof fetch
    const result = await client(fetchImpl).sendChunk(chunk([]))
    expect(result).toEqual({ ok: true, messageIds: [], accepted: [] })
    expect((fetchImpl as unknown as { mock: { calls: unknown[] } }).mock.calls).toHaveLength(0)
  })

  it("retries a 5xx exactly once", async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      return calls === 1 ? new Response("upstream boom", { status: 503 }) : okResponse()
    }) as unknown as typeof fetch

    const result = await client(fetchImpl, async () => {}).sendChunk(chunk([message(1)]))
    expect(calls).toBe(2)
    expect(result.ok).toBe(true)
  })

  it("does not retry a 4xx", async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      return new Response("bad sender", { status: 400 })
    }) as unknown as typeof fetch

    const result = await client(fetchImpl, async () => {}).sendChunk(chunk([message(1)]))
    expect(calls).toBe(1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.retryable).toBe(false)
      expect(result.rateLimited).toBe(false)
      expect(result.status).toBe(400)
    }
  })

  it("never retries a 429 and tells the caller to stop", async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      return new Response("slow down", { status: 429, headers: { "retry-after": "30" } })
    }) as unknown as typeof fetch

    const result = await client(fetchImpl, async () => {}).sendChunk(chunk([message(1)]))
    expect(calls).toBe(1)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.rateLimited).toBe(true)
      expect(result.status).toBe(429)
    }
  })

  it("retries a network error once", async () => {
    let calls = 0
    const fetchImpl = vi.fn(async () => {
      calls += 1
      if (calls === 1) throw new Error("socket hang up")
      return okResponse()
    }) as unknown as typeof fetch

    const result = await client(fetchImpl, async () => {}).sendChunk(chunk([message(1)]))
    expect(calls).toBe(2)
    expect(result.ok).toBe(true)
  })

  it("refuses to send without a key", async () => {
    const instance = new BrevoClient(newsletterConfig({ BREVO_API_KEY: "" }), { apiKey: "" })
    const result = await instance.sendChunk(chunk([message(1)]))
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.reason).toBe("brevo_not_configured")
  })
})

describe("sendTransactional", () => {
  it("wraps a single recipient with the [TEST]-safe shape", async () => {
    const fetchImpl = vi.fn(async () => okResponse()) as unknown as typeof fetch
    const result = await client(fetchImpl).sendTransactional({
      to: "reader@example.com",
      subject: "[TEST] Solo Leveling season 3 is confirmed",
      html: "<p>hello</p>",
      text: "hello",
      tags: ["daily-digest", "test"],
    })

    expect(result.ok).toBe(true)
    const body = JSON.parse(
      String((fetchImpl as unknown as { mock: { calls: [string, RequestInit][] } }).mock.calls[0][1].body),
    ) as { messageVersions: { to: { email: string }[] }[]; subject: string }
    expect(body.messageVersions).toHaveLength(1)
    expect(body.messageVersions[0].to[0].email).toBe("reader@example.com")
    expect(body.subject.startsWith("[TEST]")).toBe(true)
  })
})
