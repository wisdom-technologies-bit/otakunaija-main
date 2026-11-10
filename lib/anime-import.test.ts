import { describe, expect, it } from "vitest"
import { classifyImportResponse, parseAniListId } from "./anime-import"

describe("parseAniListId", () => {
  it("accepts an id, a link and a title link", () => {
    expect(parseAniListId("21")).toBe(21)
    expect(parseAniListId(21)).toBe(21)
    expect(parseAniListId(" 21 ")).toBe(21)
    expect(parseAniListId("https://anilist.co/anime/21")).toBe(21)
    expect(parseAniListId("anilist.co/anime/21/One-Piece")).toBe(21)
    expect(parseAniListId("http://anilist.co/anime/16498?x=1")).toBe(16498)
  })

  it("rejects junk instead of guessing", () => {
    expect(parseAniListId("")).toBeNull()
    expect(parseAniListId(null)).toBeNull()
    expect(parseAniListId("one piece")).toBeNull()
    expect(parseAniListId(0)).toBeNull()
    expect(parseAniListId(-5)).toBeNull()
  })
})

describe("classifyImportResponse", () => {
  it("reads a placeholder result", () => {
    expect(classifyImportResponse(true, 200, { status: "placeholder", message: "Created" })).toEqual({
      status: "placeholder",
      message: "Created",
    })
    expect(classifyImportResponse(true, 200, { placeholder: true }).status).toBe("placeholder")
  })

  it("treats an accepted request as queued", () => {
    expect(classifyImportResponse(true, 202, { status: "queued" })).toEqual({ status: "queued", message: "queued" })
    expect(classifyImportResponse(true, 200, {}).status).toBe("queued")
  })

  it("reports failures without the HTTP body", () => {
    expect(classifyImportResponse(false, 401, null)).toEqual({ status: "error", message: "Play service responded 401" })
    expect(classifyImportResponse(true, 200, { ok: false, message: "duplicate" })).toEqual({
      status: "error",
      message: "duplicate",
    })
  })
})
