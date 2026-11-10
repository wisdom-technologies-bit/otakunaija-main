#!/usr/bin/env node
/**
 * Real-browser regression for the "Upcoming" card badges.
 *
 *   node scripts/check-upcoming-badges.mjs http://127.0.0.1:3000
 *
 * Measures the format chip, the "On site" chip and the airing chip on
 * /episodes/upcoming and on the /episodes rail at phone and desktop widths and
 * fails when any two of them intersect. Needs Playwright (`npm i -D playwright`
 * or a global install); set PLAYWRIGHT_CHROMIUM_PATH to reuse a cached browser.
 */
import process from "node:process"

const BASE = process.argv[2] || "http://127.0.0.1:3000"
const WIDTHS = [360, 390, 412, 768, 1366]
const SURFACES = [
  { name: "grid", path: "/episodes/upcoming?view=season", selector: '[data-testid="upcoming-badge-row"]' },
  { name: "rail", path: "/episodes", selector: '[data-testid="upcoming-badge-row"]' },
]

async function loadChromium() {
  // PLAYWRIGHT_MODULE lets CI reuse a Playwright that lives outside the repo.
  for (const id of [process.env.PLAYWRIGHT_MODULE, "playwright", "playwright-core"].filter(Boolean)) {
    try {
      const mod = await import(id)
      const chromium = mod.chromium ?? mod.default?.chromium
      if (chromium) return chromium
    } catch {
      /* try the next one */
    }
  }
  throw new Error("Playwright is not installed. Run `npm i -D playwright` first.")
}

/** Every measured chip rect, relative to the poster it sits on. */
const measure = ({ selector }) => {
  const rows = [...document.querySelectorAll(selector)]
  return rows.map((row) => {
    // The poster container: the media wrapper the chip row is absolutely positioned in.
    const card = row.closest(".otk-upcoming-media") ?? row.parentElement ?? row
    const cardRect = card.getBoundingClientRect()
    const chips = [...row.querySelectorAll("[data-badge]")].map((chip) => {
      const rect = chip.getBoundingClientRect()
      return {
        label: chip.getAttribute("data-badge"),
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        w: Math.round(rect.width),
        h: Math.round(rect.height),
      }
    })
    return {
      cardWidth: Math.round(cardRect.width),
      rowWidth: Math.round(row.getBoundingClientRect().width),
      cardRight: Math.round(cardRect.right),
      chips,
    }
  })
}

function intersects(a, b) {
  return a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h
}

const chromium = await loadChromium()
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined
const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] })

let failures = 0
const report = []

for (const width of WIDTHS) {
  const context = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1 })
  const page = await context.newPage()

  for (const surface of SURFACES) {
    await page.goto(`${BASE}${surface.path}`, { waitUntil: "networkidle" })
    await page.waitForSelector(surface.selector, { timeout: 15000 }).catch(() => null)
    const rows = await page.evaluate(measure, { selector: surface.selector })

    if (rows.length === 0) {
      report.push({ width, surface: surface.name, cards: 0, note: "no badge rows rendered" })
      await page.screenshot({ path: `/tmp/badges-${surface.name}-${width}.png`, fullPage: false })
      continue
    }

    let surfaceFailures = 0
    for (const row of rows) {
      for (let i = 0; i < row.chips.length; i += 1) {
        for (let j = i + 1; j < row.chips.length; j += 1) {
          if (intersects(row.chips[i], row.chips[j])) {
            surfaceFailures += 1
            report.push({ width, surface: surface.name, overlap: [row.chips[i], row.chips[j]] })
          }
        }
        const chip = row.chips[i]
        if (chip.x + chip.w > row.cardRight + 1) {
          surfaceFailures += 1
          report.push({ width, surface: surface.name, overflow: chip, cardRight: row.cardRight })
        }
      }
    }

    failures += surfaceFailures
    report.push({
      width,
      surface: surface.name,
      cards: rows.length,
      labels: [...new Set(rows.flatMap((r) => r.chips.map((c) => c.label)))],
      cardWidth: rows[0]?.cardWidth,
      overlaps: surfaceFailures,
    })
    await page.screenshot({ path: `/tmp/badges-${surface.name}-${width}.png`, fullPage: false })
  }

  await context.close()
}

await browser.close()

for (const line of report) console.log(JSON.stringify(line))
console.log(failures === 0 ? "PASS: no overlapping or overflowing chips" : `FAIL: ${failures} problem(s)`)
process.exit(failures === 0 ? 0 : 1)
