/**
 * Regression harness for the listings UI (Prompt UI-2).
 *
 * Runs against a live server and asserts the things that broke on the live site:
 *
 *   1. every route that renders a shared card is actually styled
 *   2. no <img> is taller than 1.2x the viewport (the giant-poster bug)
 *   3. no horizontal overflow
 *   4. ticker: strip/label are one height, the headline is vertically centred
 *   5. Watch now: the play button is centred in the 16:9 thumbnail
 *   6. Trending series: fixed columns, no poster overlap, rank numeral inside
 *   7. Cover-less cards: chips never overlap each other
 *   8. Sidebar: each section is a padded card with a 24px gap
 *
 * Usage:  BASE=http://127.0.0.1:3200 node scripts/ui-regression.mjs
 * Exit code 1 when an assertion fails, so CI can run it after `next build`.
 */
import { chromium } from "playwright"

const BASE = process.env.BASE ?? "http://127.0.0.1:3000"
const VIEWPORTS = [
  { label: "phone", width: 390, height: 844 },
  { label: "desktop", width: 1366, height: 768 },
]

const ROUTES = [
  "/",
  "/blog",
  "/blog/story-1",
  "/blog/story-2",
  "/episodes",
  "/episodes/series-1",
  "/episodes/series-1/series-1-episode-1",
  "/episodes/browse",
  "/episodes/new-releases",
  "/episodes/movies/browse",
  "/episodes/search?q=one",
  "/definitely-not-a-page",
]

const failures = []
const report = { assertions: 0, routes: [], metrics: {} }

function check(condition, message, detail) {
  report.assertions += 1
  if (!condition) failures.push(detail ? `${message} :: ${JSON.stringify(detail)}` : message)
}

const browser = await chromium.launch()

for (const viewport of VIEWPORTS) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height } })
  const page = await context.newPage()

  for (const route of ROUTES) {
    await page.goto(`${BASE}${route}`, { waitUntil: "load" })
    await page.waitForTimeout(350)

    const data = await page.evaluate(() => {
      const vh = window.innerHeight
      const tallImages = [...document.querySelectorAll("img")]
        .map((img) => ({ src: (img.currentSrc || img.src || "").slice(-40), h: Math.round(img.getBoundingClientRect().height) }))
        .filter((img) => img.h > vh * 1.2)
      const cards = [...document.querySelectorAll(".otk-card")].slice(0, 3).map((card) => {
        const cs = getComputedStyle(card)
        return { radius: cs.borderTopLeftRadius, position: cs.position }
      })
      return {
        tallImages,
        maxImageHeight: Math.max(0, ...[...document.querySelectorAll("img")].map((i) => i.getBoundingClientRect().height)),
        overflow: document.documentElement.scrollWidth - window.innerWidth,
        cards,
        cardCount: document.querySelectorAll(".otk-card").length,
      }
    })

    check(data.tallImages.length === 0, `${viewport.label} ${route}: image taller than 1.2x viewport`, data.tallImages)
    check(data.overflow <= 1, `${viewport.label} ${route}: horizontal overflow`, { overflow: data.overflow })
    if (data.cardCount > 0) {
      check(
        data.cards.every((card) => card.position === "relative" && card.radius !== "0px"),
        `${viewport.label} ${route}: .otk-card not styled`,
        data.cards,
      )
    }

    report.routes.push({ viewport: viewport.label, route, cardCount: data.cardCount, maxImageHeight: Math.round(data.maxImageHeight), overflow: data.overflow })
  }

  // ---------- home page geometry ----------
  await page.goto(`${BASE}/`, { waitUntil: "load" })
  await page.waitForTimeout(500)

  const home = await page.evaluate(() => {
    const rect = (el) => (el ? el.getBoundingClientRect() : null)
    const centre = (el) => {
      const r = rect(el)
      return r ? r.top + r.height / 2 : null
    }
    const strip = document.querySelector(".otk-ticker")
    const label = document.querySelector(".otk-ticker-label")
    const headline = document.querySelector(".otk-ticker-item a")

    const card = document.querySelector("[data-episode-card]")
    const thumb = card?.querySelector(".otk-card-media")
    const play = card?.querySelector(".otk-ep-play")

    const trending = [...document.querySelectorAll(".otk-trending-card")]
    const posters = trending.map((link) => rect(link.querySelector(".otk-rank-card")))
    const ranks = trending.map((link) => rect(link.querySelector(".otk-rank")))

    const sideSections = [...document.querySelectorAll(".otk-aside-section")].map((el) => {
      const cs = getComputedStyle(el)
      return { padding: cs.paddingTop, radius: cs.borderTopLeftRadius, border: cs.borderTopWidth }
    })
    const aside = document.querySelector(".otk-aside")

    const chipsOverlapping = [...document.querySelectorAll(".otk-card")].flatMap((cardEl) => {
      const chips = [...cardEl.querySelectorAll(".otk-card-chips .otk-chip, .otk-card-media > .otk-chip-new")]
      const boxes = chips.map((c) => rect(c)).filter(Boolean)
      const pairs = []
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]
          const b = boxes[j]
          const overlap = a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1
          if (overlap) pairs.push([i, j])
        }
      }
      return pairs
    })

    const overlaps = []
    for (let i = 0; i < posters.length; i += 1) {
      for (let j = i + 1; j < posters.length; j += 1) {
        if (posters[i] && posters[j] && posters[i].right > posters[j].left + 1) overlaps.push([i, j])
      }
    }

    return {
      ticker: {
        strip: rect(strip)?.height ?? null,
        label: rect(label)?.height ?? null,
        headlineCentre: centre(headline),
        stripCentre: centre(strip),
      },
      play: {
        thumb: thumb ? { w: rect(thumb).width, h: rect(thumb).height, cx: rect(thumb).left + rect(thumb).width / 2, cy: centre(thumb) } : null,
        circle: play ? { w: rect(play).width, h: rect(play).height, cx: rect(play).left + rect(play).width / 2, cy: centre(play) } : null,
      },
      trending: {
        count: trending.length,
        widths: trending.map((el) => Math.round(rect(el).width)),
        posterWidths: posters.map((p) => (p ? Math.round(p.width) : null)),
        overlaps,
        ranksInside: ranks.map((rank, index) => {
          const poster = posters[index]
          if (!rank || !poster) return false
          return rank.left >= poster.left - 0.5 && rank.right <= poster.right + 0.5 && rank.top >= poster.top - 0.5 && rank.bottom <= poster.bottom + 0.5
        }),
        headingOneRow: (() => {
          const head = document.querySelector("#home-trending-series-heading")?.closest(".otk-section-head")
          const link = head?.querySelector("a")
          if (!head || !link) return null
          return Math.abs(link.getBoundingClientRect().top - head.getBoundingClientRect().top) < head.getBoundingClientRect().height
        })(),
      },
      chipsOverlapping,
      sidebar: {
        sections: sideSections,
        gap: aside ? getComputedStyle(aside).rowGap : null,
      },
    }
  })

  report.metrics[viewport.label] = home

  if (home.ticker.strip !== null) {
    check(Math.abs(home.ticker.strip - home.ticker.label) <= 1, `${viewport.label}: ticker label height != strip height`, home.ticker)
    check(
      Math.abs(home.ticker.headlineCentre - home.ticker.stripCentre) <= 1.5,
      `${viewport.label}: ticker headline not vertically centred`,
      home.ticker,
    )
    const expected = viewport.width < 768 ? 40 : 44
    check(Math.abs(home.ticker.strip - expected) <= 1, `${viewport.label}: ticker strip is not ${expected}px`, home.ticker)
  }

  if (home.play.circle && home.play.thumb) {
    check(
      Math.abs(home.play.circle.cy - home.play.thumb.cy) <= 2 && Math.abs(home.play.circle.cx - home.play.thumb.cx) <= 2,
      `${viewport.label}: play button not centred in the thumbnail`,
      home.play,
    )
    const size = viewport.width < 768 ? 44 : 52
    check(Math.abs(home.play.circle.w - size) <= 2, `${viewport.label}: play circle is not ${size}px`, home.play.circle)
  }

  if (home.trending.count > 0) {
    check(home.trending.overlaps.length === 0, `${viewport.label}: trending posters overlap`, home.trending.overlaps)
    check(home.trending.ranksInside.every(Boolean), `${viewport.label}: rank numeral outside the poster`, home.trending.ranksInside)
    const expectedWidth = viewport.width < 640 ? 144 : 168
    check(
      home.trending.widths.every((w) => Math.abs(w - expectedWidth) <= 2),
      `${viewport.label}: trending column is not ${expectedWidth}px`,
      home.trending.widths,
    )
    check(home.trending.headingOneRow !== false, `${viewport.label}: trending heading link wraps under the title`)
  }

  check(home.chipsOverlapping.length === 0, `${viewport.label}: card chips overlap`, home.chipsOverlapping)

  if (home.sidebar.sections.length > 0) {
    check(
      home.sidebar.sections.every((s) => s.padding === "20px" && s.radius !== "0px" && s.border === "1px"),
      `${viewport.label}: sidebar sections are not padded cards`,
      home.sidebar.sections,
    )
    check(home.sidebar.gap === "24px", `${viewport.label}: sidebar gap is not 24px`, home.sidebar.gap)
  }

  await context.close()
}

await browser.close()

console.log(JSON.stringify(report, null, 1))

if (failures.length > 0) {
  console.error(`\n${failures.length} assertion(s) failed:`)
  for (const failure of failures) console.error(` - ${failure}`)
  process.exit(1)
}

console.log(`\nAll ${report.assertions} UI assertions passed.`)
