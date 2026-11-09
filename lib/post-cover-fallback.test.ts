import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { PostCoverFallback } from "@/components/post-cover-fallback"

describe("PostCoverFallback", () => {
  it("renders the shared tile when a post has no cover", () => {
    const html = renderToStaticMarkup(createElement(PostCoverFallback, { category: "News" }))

    expect(html).toContain('data-fallback="post-cover"')
    expect(html).toContain("otk-fallback-news")
    // exactly one label, one icon: no site mark stacked on top of the chip row
    expect(html).not.toContain("OtakuNaija")
    expect(html).toContain("otk-cover-fallback-label")
    expect(html).toContain("News")
    // never a broken image or the generated placeholder
    expect(html).not.toContain("<img")
    expect(html).not.toContain("placeholder.svg")
  })

  it("uses the category tint and label for each section", () => {
    const html = renderToStaticMarkup(createElement(PostCoverFallback, { category: "Guides" }))
    expect(html).toContain("otk-fallback-guides")
    expect(html).toContain("Guides")
  })

  it("hides the decorative mark and label in tiny slots", () => {
    const html = renderToStaticMarkup(
      createElement(PostCoverFallback, { category: "Action", showLabel: false }),
    )
    expect(html).toContain('data-fallback="post-cover"')
    expect(html).not.toContain("OtakuNaija")
    expect(html).not.toContain(">Action<")
  })

  it("is decorative for assistive tech", () => {
    const html = renderToStaticMarkup(createElement(PostCoverFallback, { category: "News" }))
    expect(html).toContain('aria-hidden="true"')
  })
})
