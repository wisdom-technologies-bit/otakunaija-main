import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const uploadImageBuffer = vi.fn(async () => ({ url: "https://res.cloudinary.com/demo/image/upload/cover.jpg", publicId: "cover" }))
const isCloudinaryConfigured = vi.fn(() => true)

vi.mock("@/lib/cloudinary", () => ({
  isCloudinaryConfigured: () => isCloudinaryConfigured(),
  uploadImageBuffer: (...args: unknown[]) => uploadImageBuffer(...(args as [])),
}))

import { IMAGE_REFERER, copyImageToCloudinary, normalizeCopyResult } from "./image"

const OG = "https://www.animenewsnetwork.com/thumbnails/max600x600/cms/news/1.jpg"

function imageResponse(overrides: Partial<{ status: number; type: string; bytes: number }> = {}) {
  const { status = 200, type = "image/jpeg", bytes = 1024 } = overrides
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ "content-type": type }),
    arrayBuffer: async () => new ArrayBuffer(bytes),
  } as unknown as Response
}

beforeEach(() => {
  uploadImageBuffer.mockClear()
  isCloudinaryConfigured.mockReturnValue(true)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("copyImageToCloudinary", () => {
  it("sends an ANN Referer and a browser-like Accept header", async () => {
    const fetchMock = vi.fn(async () => imageResponse())
    vi.stubGlobal("fetch", fetchMock)

    const result = await copyImageToCloudinary(OG)

    expect(result).toEqual({ url: "https://res.cloudinary.com/demo/image/upload/cover.jpg" })
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    const headers = init.headers as Record<string, string>
    expect(headers.Referer).toBe(IMAGE_REFERER)
    expect(headers.Accept).toContain("image/")
    expect(init.redirect).toBe("follow")
    expect(uploadImageBuffer).toHaveBeenCalledTimes(1)
  })

  it("reports the status code instead of throwing on 403", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse({ status: 403 })))

    await expect(copyImageToCloudinary(OG)).resolves.toEqual({ error: "image_http_403" })
    expect(uploadImageBuffer).not.toHaveBeenCalled()
  })

  it("retries once on a 5xx and succeeds", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(imageResponse({ status: 503 }))
      .mockResolvedValueOnce(imageResponse())
    vi.stubGlobal("fetch", fetchMock)

    const result = await copyImageToCloudinary(OG)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result).toEqual({ url: "https://res.cloudinary.com/demo/image/upload/cover.jpg" })
  })

  it("rejects non-image responses", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => imageResponse({ type: "text/html" })))

    await expect(copyImageToCloudinary(OG)).resolves.toEqual({ error: "image_not_image" })
  })

  it("returns a typed error when Cloudinary is not configured", async () => {
    isCloudinaryConfigured.mockReturnValue(false)
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    await expect(copyImageToCloudinary(OG)).resolves.toEqual({ error: "cloudinary_not_configured" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("never throws when the network request fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("boom")
    }))

    await expect(copyImageToCloudinary(OG)).resolves.toEqual({ error: "image_fetch_failed" })
  })
})

describe("normalizeCopyResult", () => {
  it("accepts the legacy string/null shapes used by older callers", () => {
    expect(normalizeCopyResult("https://cdn/x.jpg")).toEqual({ url: "https://cdn/x.jpg" })
    expect(normalizeCopyResult(null)).toEqual({ error: "no_image" })
    expect(normalizeCopyResult({ error: "image_http_403" })).toEqual({ error: "image_http_403" })
  })
})
