import { describe, expect, it } from "vitest"
import { allLayoutContexts, fixtureContext } from "./fixtures"
import { renderIssue } from "./render"
import { LAYOUT_IDS } from "./layout"
import { GMAIL_CLIP_BYTES } from "./render/theme"

const TOKEN = "abc123token"

function countImages(html: string): { total: number; withAlt: number } {
  const tags = html.match(/<img\b[^>]*>/gi) ?? []
  const withAlt = tags.filter((tag) => /\balt="/i.test(tag))
  return { total: tags.length, withAlt: withAlt.length }
}

describe("renderIssue", () => {
  it("renders one email per layout", async () => {
    const contexts = allLayoutContexts()
    expect(contexts).toHaveLength(LAYOUT_IDS.length)

    for (const { layout, ctx } of contexts) {
      const output = await renderIssue({ ...ctx, layout, token: TOKEN })

      expect(output.html.length).toBeGreaterThan(2_000)
      expect(output.text.length).toBeGreaterThan(200)
      expect(output.bytes).toBeLessThan(GMAIL_CLIP_BYTES)
      expect(output.kb).toBeLessThan(90)

      // Every image is described and sized.
      const images = countImages(output.html)
      expect(images.total).toBeGreaterThan(0)
      expect(images.withAlt).toBe(images.total)
      expect(output.html).not.toMatch(/<img(?![^>]*\bwidth=)[^>]*>/i)
      expect(output.html).not.toMatch(/<img(?![^>]*\bheight=)[^>]*>/i)
      expect(output.html).not.toMatch(/<img(?![^>]*display:\s*block)[^>]*>/i)

      // No scripts, no relative URLs.
      expect(output.html.toLowerCase()).not.toContain("<script")
      expect(output.html).not.toMatch(/(?:src|href)="(?!https?:|mailto:|#)/i)

      // Dark mode and the hidden preheader.
      expect(output.html).toContain('name="color-scheme"')
      expect(output.html).toContain("prefers-color-scheme")
      expect(output.html).toContain('style="display:none')

      // The token is what makes the footer links personal.
      expect(output.html).toContain(`/newsletter/unsubscribe?token=${TOKEN}`)
      expect(output.html).toContain(`/newsletter/preferences?token=${TOKEN}`)
      expect(output.text).toContain(`/newsletter/unsubscribe?token=${TOKEN}`)
      expect(output.html).toContain("You are receiving this because you subscribed on otakunaija.name.ng")
      expect(output.html).toContain("Victoria Island")

      // Bulletproof buttons: a VML fallback for Outlook next to the link.
      expect(output.html).toContain("v:roundrect")

      // Plain text keeps the important calls to action.
      expect(output.text).toContain("Unsubscribe")
    }
  })

  it("keeps every layout under the Gmail clip limit with big content", async () => {
    for (const layout of LAYOUT_IDS) {
      const ctx = fixtureContext({ layout })
      const output = await renderIssue({ ...ctx, layout, token: TOKEN })
      expect(output.bytes).toBeLessThan(GMAIL_CLIP_BYTES)
    }
  })

  it("renders a visibly different structure per layout", async () => {
    const htmls = await Promise.all(
      LAYOUT_IDS.map(async (layout) => {
        const ctx = fixtureContext({ layout })
        const output = await renderIssue({ ...ctx, layout, token: TOKEN })
        return output.html
      }),
    )

    // Each pair differs in a way a reader would notice, not just a token swap.
    const stripped = htmls.map((html) => html.split(TOKEN).join("X"))
    for (let i = 0; i < stripped.length; i += 1) {
      for (let j = i + 1; j < stripped.length; j += 1) {
        expect(stripped[i]).not.toBe(stripped[j])
      }
    }
  })

  it("hides modules the subscriber turned off", async () => {
    const ctx = fixtureContext({ layout: "episode-drop" })
    const withEpisodes = await renderIssue({ ...ctx, layout: "episode-drop", token: TOKEN })
    const withoutEpisodes = await renderIssue({
      ...ctx,
      layout: "episode-drop",
      token: TOKEN,
      prefs: { news: true, episodes: false, upcoming: false, frequency: "daily" },
    })

    expect(withEpisodes.html.length).toBeGreaterThan(withoutEpisodes.html.length)
    // The poster wall is gone, but the footer links stay usable.
    expect(withoutEpisodes.html).not.toContain("Solo Leveling ·")
    expect(withoutEpisodes.html).toContain(`/newsletter/preferences?token=${TOKEN}`)
    expect(withoutEpisodes.html).toContain(`/newsletter/unsubscribe?token=${TOKEN}`)
    expect(withoutEpisodes.text).toContain(`/newsletter/preferences?token=${TOKEN}`)
  })

  it("is stable for the same input", async () => {
    const ctx = fixtureContext({ layout: "roundup" })
    const first = await renderIssue({ ...ctx, layout: "roundup", token: TOKEN })
    const second = await renderIssue({ ...ctx, layout: "roundup", token: TOKEN })
    expect(second.html).toBe(first.html)
  })
})
