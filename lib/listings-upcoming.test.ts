import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), "utf8")

/**
 * Source-level regressions for the "Upcoming" work. Geometry (do the chips
 * actually overlap?) is measured in a real browser by
 * scripts/check-upcoming-badges.mjs; these assertions keep the markup and the
 * queries from drifting away from the fix.
 */

describe("upcoming badge row", () => {
  const css = read("app/listings.css")

  it("puts the chips in one wrapping row instead of opposite corners", () => {
    const block = css.match(/\.otk-badge-row\s*\{([^}]*)\}/)?.[1] ?? ""
    expect(block).toMatch(/display:\s*flex/)
    expect(block).toMatch(/flex-wrap:\s*wrap/)
    expect(block).toMatch(/gap:\s*4px/)
    expect(block).toMatch(/max-width:\s*calc\(100%\s*-\s*16px\)/)
    expect(block).toMatch(/position:\s*absolute/)
  })

  it("sizes the on-site chip to the card, not the viewport", () => {
    expect(css).toMatch(/\.otk-upcoming-media\s*\{[^}]*container-type:\s*inline-size/)
    expect(css).toMatch(/\.otk-chip-onsite-full\s*\{[^}]*display:\s*none/)
    const container = css.match(/@container \(min-width: 11rem\)\s*\{([\s\S]*?)\n\}/)?.[1] ?? ""
    expect(container).toMatch(/\.otk-chip-onsite-short\s*\{\s*display:\s*none/)
    expect(container).toMatch(/\.otk-chip-onsite-full\s*\{\s*display:\s*inline/)
  })

  it("uses that row on the grid and on the rail", () => {
    for (const file of ["components/episodes/upcoming-grid.tsx", "components/episodes/upcoming-section.tsx"]) {
      const source = read(file)
      expect(source).toContain("otk-badge-row")
      expect(source).toContain("otk-upcoming-media")
      expect(source).toContain("<OnSiteChip />")
      // no chip may be pinned to the far corner again
      expect(source).not.toMatch(/otk-chip[^"]*absolute right-/)
    }
  })

  it("keeps both label widths in one chip, one accessible name", () => {
    const chip = read("components/episodes/on-site-chip.tsx")
    expect(chip).toContain("otk-chip-onsite-short")
    expect(chip).toContain("otk-chip-onsite-full")
    expect(chip).toContain("On site")
    expect(chip).toContain("On OtakuNaija")
  })

  it("still uses the existing upcoming chip class", () => {
    const helpers = read("lib/series-upcoming.ts")
    expect(helpers).toContain('upcoming: "otk-chip-status-upcoming"')
    expect(read("app/listings.css")).toContain(".otk-chip-status-upcoming")
  })
})

describe("upcoming listings", () => {
  const queries = read("lib/db/queries.ts")

  it("keeps upcoming titles out of trending", () => {
    const trending = queries.slice(
      queries.indexOf("const _getTrendingSeries"),
      queries.indexOf("const _getPopularTodaySeries") === -1 ? undefined : queries.indexOf("export async function getPopularTodaySeries"),
    )
    expect(trending).toContain("ne(series.status, 'upcoming')")
  })

  it("keeps upcoming titles out of the sitemap source data", () => {
    const sitemapQuery = queries.slice(
      queries.indexOf("_getAllSeriesWithEpisodesForSitemap"),
      queries.indexOf("export async function getAllSeriesWithEpisodesForSitemap"),
    )
    expect(sitemapQuery).toContain("ne(series.status, 'upcoming')")
  })

  it("is episode-driven where the rows claim to be", () => {
    const popular = queries.split("export async function getPopularTodaySeries")[1]?.split("export async function")[0] ?? ""
    expect(popular).toContain("episodeDailyViews")
  })

  it("wires the Upcoming status filter in browse", () => {
    expect(queries).toContain("['ongoing', 'completed', 'upcoming'].includes(status)")
    expect(read("app/episodes/browse/page.tsx")).toContain("'upcoming'")
    expect(read("components/episodes/catalog-toolbar.tsx").length).toBeGreaterThan(0)
  })

  it("orders an upcoming browse page by release date", () => {
    expect(queries).toContain("status === 'upcoming'")
    expect(queries).toContain("startDate} ASC NULLS LAST")
  })
})

describe("upcoming series page", () => {
  const page = read("app/episodes/[series-slug]/page.tsx")

  it("is noindex, follow until the series starts airing", () => {
    expect(page).toContain("robots: { index: false, follow: true }")
    expect(page).toContain("isUpcomingSeries(data.series)")
  })

  it("shows the chip, the release line and the trailer, and no empty episodes panel", () => {
    // The status chip and the coming label still come from the shared helpers,
    // now rendered by the hero band and the upcoming panel.
    expect(page).toContain("seriesComingLabel(series)")
    expect(read("components/episodes/series-hero-band.tsx")).toContain("seriesStatusLabel(series.status)")
    // The upcoming branch renders the not-yet-released panel instead of the tabs.
    expect(page).toContain("<SeriesUpcomingPanel")
    expect(page.indexOf("<SeriesUpcomingPanel")).toBeLessThan(page.indexOf("<SeriesTabs tabs={tabs} />"))
    expect(page).toContain("{upcoming ? (")
    // The trailer action lives in the panel, and only YouTube is embeddable.
    const panelSource = read("components/episodes/series-upcoming-panel.tsx")
    expect(panelSource).toContain("<TrailerModal")
    expect(read("lib/episode-ui.ts")).toContain("youtube-nocookie.com/embed")
    expect(panelSource).toContain('data-testid="series-upcoming-panel"')
  })

  it("renders the title logo without a TMDB call on render", () => {
    expect(page).toContain("<SeriesHeroBand")
    expect(read("components/episodes/series-hero-band.tsx")).toContain("logoPath={series.logoPath}")
    expect(page).not.toMatch(/fetchLogoFor|themoviedb\.org|await logoUrl/)
    // the reader is a pure URL builder: no fetch happens while rendering
    const logo = read("components/episodes/series-logo.tsx")
    expect(logo).toContain("logoUrl(")
    expect(logo).not.toMatch(/fetch\(|await\s/)
  })

  it("shows a series with zero episodes without crashing", () => {
    const panel = read("components/episodes/series-episodes-panel.tsx")
    expect(panel).toContain("No episodes yet")
    expect(panel).toContain("episodes.length === 0")
    expect(panel).toContain("visible.length === 0")
  })
})

describe("admin import", () => {
  it("only offers Add to OtakuNaija to admins on titles that are not on site", () => {
    const grid = read("components/episodes/upcoming-grid.tsx")
    expect(grid).toContain("isAdmin && !item.onSite")
    expect(grid).toContain("<AdminImportButton")
    expect(read("app/episodes/upcoming/page.tsx")).toContain("const isAdmin = Boolean(session)")
  })

  it("guards the endpoint with the admin session", () => {
    const route = read("app/api/admin/anime-import/route.ts")
    expect(route).toContain("getCurrentSession()")
    expect(route).toContain("x-play-request-secret")
    // the secret must never travel in a response
    expect(route).not.toMatch(/NextResponse\.json\([^)]*secret/i)
  })
})

describe("play contracts stay compatible", () => {
  it("keeps the play key guard and the seriesId response", () => {
    const route = read("app/api/play/anime/route.ts")
    expect(route).toContain("hasValidPlayApiKey(request)")
    expect(route).toContain("seriesId")
    expect(route).toContain("created")
    expect(route).toContain("updated")
  })

  it("does not map every status to ongoing any more", () => {
    const helpers = read("lib/play-anime.ts")
    expect(helpers).toContain("return 'upcoming'")
    expect(helpers).toContain("Anything -> upcoming is refused")
  })
})
