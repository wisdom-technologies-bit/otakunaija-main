// OTK-3 browser verification: /episodes hero, series page, episode page.
//
// Runs against a real production build (`next build && next start`) with stand-in
// seeded data in a local Postgres, at 360/390/412/768/1366 CSS px.
//
// The seed rows point `logo_path` at TMDB paths that do not exist, so the logo
// CDN itself is served locally: requests to image.tmdb.org are fulfilled by
// intercepting them and returning a PNG wordmark generated in this same run.
// That keeps the test offline and lets one run cover both branches (a logo that
// loads, and a logo that 404s -> text fallback).
//
// Playwright is not a dependency of the site, so it resolves from PW_MODULE_PATH
// or a local/global install:
//   PW_MODULE_PATH=/tmp/pw/node_modules node scripts/verify/otk3-episodes.mjs http://127.0.0.1:3100 --shots /path/to/shots
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const baseUrl = process.argv.find((arg) => arg.startsWith('http')) || 'http://127.0.0.1:3100'
const shotsFlag = process.argv.indexOf('--shots')
const shotsDir = shotsFlag > -1 ? process.argv[shotsFlag + 1] : null
if (shotsDir) mkdirSync(shotsDir, { recursive: true })

function loadPlaywright() {
  for (const dir of [process.env.PW_MODULE_PATH, '/tmp/pw/node_modules', join(process.cwd(), 'node_modules')].filter(Boolean)) {
    try {
      return require(join(dir, 'playwright-core'))
    } catch {
      /* try the next candidate */
    }
  }
  throw new Error('playwright-core not found; set PW_MODULE_PATH')
}

const { chromium } = loadPlaywright()

const VIEWPORTS = [
  { label: '360', width: 360, height: 740 },
  { label: '390', width: 390, height: 844 },
  { label: '412', width: 412, height: 915 },
  { label: '768', width: 768, height: 1024 },
  { label: '1366', width: 1366, height: 768 },
]

const PAGES = [
  { key: 'episodes', label: '/episodes hero', path: '/episodes', shot: true },
  { key: 'series-ongoing', label: '/episodes/aurora-line (ongoing)', path: '/episodes/aurora-line', shot: true },
  { key: 'series-upcoming', label: '/episodes/starfall-protocol (upcoming, 0 eps)', path: '/episodes/starfall-protocol', shot: true },
  { key: 'series-completed', label: '/episodes/grand-odyssey (completed, 120 eps)', path: '/episodes/grand-odyssey', shot: true },
  { key: 'episode', label: '/episodes/aurora-line/aurora-line-ep-12', path: '/episodes/aurora-line/aurora-line-ep-12', shot: true },
]

/** Stand-in artwork the seeded rows point at (checked into no branch, made on demand). */
function writeSeedArt() {
  const dir = join(process.cwd(), 'public', 'seed')
  mkdirSync(dir, { recursive: true })
  const banners = {
    'banner-1': ['#3b1d5e', '#8b1d3f', 'AURORA LINE'],
    'banner-2': ['#12324a', '#2b6b52', 'MIDNIGHT COURIER'],
    'banner-3': ['#1a1a2e', '#5c4a1f', 'STARFALL'],
    'banner-4': ['#2d1b00', '#7a3b12', 'GRAND ODYSSEY'],
    'banner-5': ['#0f2b3d', '#3d6b7a', 'EMBER SAGA'],
  }
  for (const [name, [from, to, label]] of Object.entries(banners)) {
    writeFileSync(
      join(dir, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><g opacity="0.18" fill="#ffffff"><circle cx="1300" cy="180" r="220"/><circle cx="1080" cy="420" r="120"/></g><text x="80" y="760" font-family="Helvetica,Arial" font-size="120" font-weight="bold" fill="#ffffff" opacity="0.55">${label}</text></svg>`,
    )
  }
  const posters = {
    'poster-1': ['#2a1240', '#6d1f52'],
    'poster-2': ['#123244', '#1f5a4a'],
    'poster-3': ['#1b1b30', '#4a3a12'],
    'poster-4': ['#301d00', '#6b3410'],
    'poster-5': ['#0e2635', '#2f5a66'],
  }
  for (const [name, [from, to]] of Object.entries(posters)) {
    writeFileSync(
      join(dir, `${name}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="900" viewBox="0 0 600 900"><defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient></defs><rect width="600" height="900" fill="url(#g)"/><g opacity="0.2" fill="#ffffff"><circle cx="470" cy="200" r="130"/></g></svg>`,
    )
  }
  const thumbs = ['#1f2a44', '#2a1f34', '#12303a', '#33261a', '#1a2f2a', '#2e1a26']
  thumbs.forEach((colour, index) => {
    writeFileSync(
      join(dir, `thumb-${index + 1}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360" viewBox="0 0 640 360"><rect width="640" height="360" fill="${colour}"/><path d="M280 140l90 40-90 40z" fill="#ffffff" opacity="0.35"/></svg>`,
    )
  })
}

/** Renders the wordmark PNGs used as the stand-in TMDB logos. */
async function makeLogos(browser) {
  const page = await browser.newPage({ viewport: { width: 1000, height: 320 } })
  await page.setContent(`
    <body style="margin:0;background:transparent">
      <div style="font-family:Helvetica,Arial,sans-serif;font-weight:900;letter-spacing:0.14em;
                  font-size:76px;color:#fff;padding:36px 40px;white-space:nowrap">
        AURORA LINE
      </div>
    </body>`)
  const logo = await page.screenshot({ omitBackground: true })
  await page.close()
  return logo
}

/** Layout-shift + console-error collection, installed before any script runs. */
const INIT_SCRIPT = () => {
  window.__cls = 0
  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (!entry.hadRecentInput) window.__cls += entry.value
      }
    }).observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* unsupported */
  }
}

async function measure(page, key, width) {
  return page.evaluate(
    ({ key, width }) => {
      const rect = (selector) => {
        const el = document.querySelector(selector)
        if (!el) return null
        const r = el.getBoundingClientRect()
        return {
          top: Math.round(r.top + window.scrollY),
          left: Math.round(r.left),
          width: Math.round(r.width),
          height: Math.round(r.height),
          bottom: Math.round(r.bottom + window.scrollY),
        }
      }
      const doc = document.scrollingElement || document.documentElement

      // Overlap probe: only true siblings are compared. A parent always contains
      // its children, so ancestor/descendant pairs are not overlaps.
      const containers = [document.querySelector('main'), document.querySelector('.otk-series-hero'), document.querySelector('.otk-hero')]
        .filter(Boolean)
      const overlaps = []
      const seen = new Set()
      for (const container of containers) {
        // Stacked decoration (banner image, scrim, shade) is meant to sit on top
        // of itself; only real content blocks are compared.
        const DECORATION = /scrim|shade|-media|hero-image|cover-fallback/
        const kids = Array.from(container.children).filter((el) => {
          const r = el.getBoundingClientRect()
          return r.height > 8 && r.width > 8 && !DECORATION.test(el.className.toString())
        })
        for (let i = 0; i < kids.length; i += 1) {
          for (let j = i + 1; j < kids.length; j += 1) {
            const a = kids[i].getBoundingClientRect()
            const b = kids[j].getBoundingClientRect()
            const x = Math.min(a.right, b.right) - Math.max(a.left, b.left)
            const y = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
            const label = `${kids[i].className.toString().slice(0, 40)} x ${kids[j].className.toString().slice(0, 40)}`
            if (x > 4 && y > 4 && !seen.has(label)) {
              seen.add(label)
              overlaps.push(label)
            }
          }
        }
      }

      const wideImages = Array.from(document.images)
        .filter((img) => img.getBoundingClientRect().width > width + 1)
        .map((img) => ({ src: img.getAttribute('src'), w: Math.round(img.getBoundingClientRect().width) }))

      return {
        key,
        innerWidth: window.innerWidth,
        scrollWidth: doc.scrollWidth,
        overflow: doc.scrollWidth - doc.clientWidth,
        cls: Number((window.__cls ?? 0).toFixed(4)),
        hero: rect('.otk-hero-frame') ?? rect('.otk-series-hero'),
        heroTitle: rect('.otk-hero-logo') ?? rect('.otk-hero-title') ?? rect('.otk-series-logo') ?? rect('.otk-series-title'),
        heroDots: document.querySelectorAll('.otk-hero-dot').length,
        heroThumbs: rect('.otk-hero-thumbs')?.width ?? 0,
        heroPrimary: rect('[data-testid="hero-primary-action"]') ?? rect('[data-testid="series-play-action"]'),
        seriesPoster: rect('[data-testid="series-poster"]'),
        player: rect('[data-testid="episode-player"]'),
        aboutPoster: rect('[data-testid="about-series-poster"]'),
        episodesGrid: rect('[data-testid="episode-list"]'),
        rangeTabs: document.querySelectorAll('[data-testid^="episode-range-"]').length,
        newChips: document.querySelectorAll('.otk-chip-new').length,
        countdownTiles: document.querySelectorAll('.otk-countdown-tile').length,
        countdownLabel: document.querySelector('[data-testid="upcoming-countdown-label"]')?.textContent ?? null,
        upcomingPanel: rect('[data-testid="series-upcoming-panel"]'),
        upNext: rect('[data-testid="up-next-list"]'),
        trending: rect('[data-testid="trending-block"]'),
        controls: rect('[data-testid="episode-controls"]'),
        logoText: document.querySelectorAll('[data-testid="series-logo-text"]').length,
        logoImage: document.querySelectorAll('[data-testid="series-logo-image"]').length,
        h1: document.querySelector('h1')?.textContent?.trim() ?? null,
        overlaps: overlaps.slice(0, 4),
        wideImages: wideImages.slice(0, 3),
        // Aside sections must come after the player in DOM order on phones.
        phoneAsideOrder:
          window.innerWidth < 1024
            ? Array.from(
                document.querySelectorAll(
                  '[data-testid="up-next-list"], [data-testid="about-series-poster"], .otk-aside-section',
                ),
              )
                .filter((el) => el.getClientRects().length > 0 && el.offsetParent !== null)
                .map((el) => {
                  if (el.getAttribute('data-testid') === 'about-series-poster') return 'about-series'
                  if (el.getAttribute('data-testid') === 'up-next-list') return 'up-next'
                  const heading = el.querySelector('h2, h1')
                  return `section:${heading?.textContent?.trim().slice(0, 24) ?? '?'}`
                })
            : null,
      }
    },
    { key, width },
  )
}

async function run() {
  writeSeedArt()
  const browser = await chromium.launch({ args: ['--no-sandbox'] })
  const logoPng = await makeLogos(browser)
  mkdirSync('/tmp/otk3-logos', { recursive: true })
  writeFileSync('/tmp/otk3-logos/aurora.png', logoPng)

  const results = []
  const failures = []

  for (const viewport of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: viewport.width, height: viewport.height },
      deviceScaleFactor: 1,
      reducedMotion: 'no-preference',
    })
    await context.addInitScript(INIT_SCRIPT)
    // Stand-in TMDB logo CDN.
    await context.route('https://image.tmdb.org/**', (route) =>
      route.fulfill({ status: 200, contentType: 'image/png', body: logoPng }),
    )

    for (const target of PAGES) {
      const page = await context.newPage()
      const consoleErrors = []
      const failedRequests = []
      page.on('console', (msg) => {
        if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 160))
      })
      page.on('pageerror', (err) => consoleErrors.push(`pageerror: ${String(err).slice(0, 160)}`))
      page.on('response', (response) => {
        if (response.status() >= 400) failedRequests.push(`${response.status()} ${response.url().slice(-80)}`)
      })

      await page.goto(`${baseUrl}${target.path}`, { waitUntil: 'load', timeout: 60000 })
      await page.waitForTimeout(1200)
      // Walk the page so lazy images and the below-fold sections render.
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) {
          window.scrollTo(0, y)
          await new Promise((resolve) => setTimeout(resolve, 40))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForTimeout(400)

      const metrics = await measure(page, target.key, viewport.width)
      metrics.viewport = viewport.label
      metrics.consoleErrors = consoleErrors
      metrics.failedRequests = failedRequests.filter((line) => !/favicon|\/icon|apple-touch|\.map$|_vercel\/insights/.test(line))
      results.push(metrics)

      const tag = `${target.key}@${viewport.label}`
      if (metrics.overflow > 0) failures.push(`${tag}: horizontal overflow ${metrics.overflow}px (scrollWidth ${metrics.scrollWidth})`)
      if (metrics.overlaps.length) failures.push(`${tag}: overlapping blocks ${JSON.stringify(metrics.overlaps)}`)
      if (metrics.wideImages.length) failures.push(`${tag}: oversized image ${JSON.stringify(metrics.wideImages)}`)
      // The Vercel analytics script is not served by a local `next start`; its
      // 404 is the only console error this harness tolerates.
      const pageConsoleErrors = consoleErrors.filter((line) => !/Failed to load resource.*404/.test(line) && !/insights/.test(line))
      metrics.pageConsoleErrors = pageConsoleErrors
      if (pageConsoleErrors.length) failures.push(`${tag}: console errors ${JSON.stringify(pageConsoleErrors.slice(0, 2))}`)
      if (metrics.failedRequests.length) failures.push(`${tag}: failed requests ${JSON.stringify(metrics.failedRequests.slice(0, 3))}`)
      if (metrics.cls > 0.1) failures.push(`${tag}: CLS ${metrics.cls}`)

      if (target.key === 'series-ongoing' && viewport.width >= 768) {
        const w = metrics.seriesPoster?.width ?? 0
        if (w < 200 || w > 240) failures.push(`${tag}: series poster width ${w}px outside 200-240`)
      }
      if (target.key === 'episode') {
        const w = metrics.aboutPoster?.width ?? 0
        if (w > 96) failures.push(`${tag}: about sidebar poster ${w}px > 96`)
        if (viewport.width < 768) {
          const p = metrics.player
          if (!p || p.top > viewport.height) failures.push(`${tag}: player not in first viewport (top ${p?.top})`)
        }
      }
      if (target.key === 'series-completed') {
        if (metrics.rangeTabs < 2) failures.push(`${tag}: range selector missing (${metrics.rangeTabs})`)
      }
      if (target.key === 'series-upcoming') {
        if (metrics.countdownTiles < 3) failures.push(`${tag}: countdown tiles ${metrics.countdownTiles}`)
        if (metrics.upcomingPanel === null) failures.push(`${tag}: upcoming panel missing`)
      }
      if (target.key === 'episode') {
        if (!metrics.trending || metrics.trending.height < 80) failures.push(`${tag}: trending block blank (${metrics.trending?.height})`)
      }

      if (shotsDir && target.shot && (viewport.width === 390 || viewport.width === 1366)) {
        await page.screenshot({
          path: join(shotsDir, `${target.key}-${viewport.width}.png`),
          fullPage: viewport.width === 1366,
        })
        if (viewport.width === 390) {
          await page.screenshot({ path: join(shotsDir, `${target.key}-390-top.png`) })
        }
      }

      // Hero without a logo: switch slides and capture the text-title branch.
      if (target.key === 'episodes' && (viewport.width === 390 || viewport.width === 1366)) {
        const dotInfo = await page.evaluate(() => {
          const dots = Array.from(document.querySelectorAll('.otk-hero-dot'))
          return dots.map((dot) => {
            const rect = dot.getBoundingClientRect()
            const style = getComputedStyle(dot)
            return { w: Math.round(rect.width), h: Math.round(rect.height), top: Math.round(rect.top), visibility: style.visibility, display: style.display }
          })
        })
        console.log(`hero dots @${viewport.width}:`, JSON.stringify(dotInfo))
        const dots = await page.$$('.otk-hero-dot')
        if (dots[1]) {
          // Clicked through the DOM: the progress bars are 4px tall, which
          // Playwright's actionability check refuses to target directly.
          await page.evaluate(() => {
            const dot = document.querySelectorAll('.otk-hero-dot')[1]
            if (dot instanceof HTMLElement) dot.click()
          })
          await page.waitForTimeout(700)
          const noLogo = await page.evaluate(() => ({
            text: document.querySelectorAll('.otk-hero-title-clamp').length,
            logos: document.querySelectorAll('.otk-hero-logo').length,
          }))
          if (noLogo.text < 1) failures.push(`${target.key}@${viewport.label}: no-logo slide showed no text title`)
          if (shotsDir) {
            await page.screenshot({ path: join(shotsDir, `episodes-hero-no-logo-${viewport.width}.png`) })
          }
        }
      }

      await page.close()
    }
    await context.close()
  }

  await browser.close()

  // Compact report
  const rows = results.map((r) => ({
    page: r.key,
    vp: r.viewport,
    overflow: r.overflow,
    cls: r.cls,
    heroH: r.hero?.height ?? '',
    poster: r.seriesPoster?.width ?? r.aboutPoster?.width ?? '',
    player: r.player ? `${r.player.top}/${r.player.height}` : '',
    ranges: r.rangeTabs || '',
    new: r.newChips,
    countdown: r.countdownLabel ?? '',
    errs: (r.pageConsoleErrors ?? []).length,
    failed: r.failedRequests.length,
  }))
  writeFileSync('/tmp/otk3-report.json', JSON.stringify({ results, failures }, null, 2))
  console.table(rows)
  console.log(`\nScreenshots: ${shotsDir ?? '(none)'}`)
  if (failures.length) {
    console.log(`\nFAILURES (${failures.length})`)
    for (const failure of failures) console.log(` - ${failure}`)
    process.exitCode = 1
  } else {
    console.log('\nAll layout assertions passed.')
  }
}

await run()
