import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import { ALLOWED_COVER_HOSTS, isAllowedCoverHost, remoteCoverFallback } from "./image-hosts"

const root = process.cwd()

describe("cover host allow list", () => {
  it("accepts the ANN hosts over https", () => {
    expect(isAllowedCoverHost("https://www.animenewsnetwork.com/thumbnails/x.jpg")).toBe(true)
    expect(isAllowedCoverHost("https://cdn.animenewsnetwork.com/x.jpg")).toBe(true)
  })

  it("rejects other hosts, http, and junk", () => {
    expect(isAllowedCoverHost("https://evil.example.com/x.jpg")).toBe(false)
    expect(isAllowedCoverHost("http://www.animenewsnetwork.com/x.jpg")).toBe(false)
    expect(isAllowedCoverHost("not a url")).toBe(false)
    expect(isAllowedCoverHost(null)).toBe(false)
  })

  it("only returns a remote fallback for allowed hosts", () => {
    expect(remoteCoverFallback("https://www.animenewsnetwork.com/x.jpg")).toBe(
      "https://www.animenewsnetwork.com/x.jpg",
    )
    expect(remoteCoverFallback("https://evil.example.com/x.jpg")).toBeNull()
  })

  it("stays in sync with images.remotePatterns in next.config.mjs", () => {
    const config = readFileSync(join(root, "next.config.mjs"), "utf8")
    for (const host of ALLOWED_COVER_HOSTS) {
      expect(config).toContain(`hostname: "${host}"`)
    }
  })
})
