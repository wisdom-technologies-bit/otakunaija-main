/**
 * Email design tokens.
 *
 * Values mirror the site (app/globals.css): the accent is `--primary`
 * oklch(0.68 0.22 25) converted to sRGB, the header band is the site's
 * background, and the paper is a warm off-white because a pure #fff page next
 * to the dark band looks like two different emails stitched together.
 */

/** Gmail clips a message over roughly 102 KB; keep a margin below that. */
export const GMAIL_CLIP_BYTES = 94 * 1024

export const COLORS = {
  /** Site background, used for the header band. */
  band: "#0E0D14",
  bandSoft: "#17161F",
  paper: "#F4F2EF",
  surface: "#FFFFFF",
  ink: "#101014",
  body: "#3C3B45",
  muted: "#6E6D79",
  rule: "#E2DED8",
  accent: "#FF4C4D",
  /** Accent dark enough for small text on paper (4.6:1). */
  accentInk: "#B02A22",
  accentSoft: "#FFE9E7",
  onAccent: "#FFFFFF",
} as const

export const FONTS = {
  /** Web-safe first, brand display face as the only custom fallback. */
  heading: "'Outfit', 'Trebuchet MS', 'Segoe UI', Helvetica, Arial, sans-serif",
  body: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  mono: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
} as const

export const SIZE = {
  width: 600,
  /** Outlook ignores max-width on the container, hence the fixed table width. */
  pad: 28,
  gap: 24,
} as const

export const TEXT = {
  h1: 30,
  h2: 21,
  h3: 17,
  body: 16,
  small: 13,
  micro: 11,
} as const

export const BRAND = {
  name: "OtakuNaija",
  tagline: "Anime news, episodes and what is airing next.",
} as const

/** Dark mode overrides keyed to the classes the renderers put on elements. */
export const DARK_MODE_CSS = `
:root { color-scheme: light dark; supported-color-schemes: light dark; }
a[x-apple-data-detectors] { color: inherit !important; text-decoration: none !important; }
@media (prefers-color-scheme: dark) {
  .nl-page { background: #0E0D14 !important; }
  .nl-surface { background: #17161F !important; }
  .nl-card { background: #1C1B25 !important; }
  .nl-ink { color: #F6F4F1 !important; }
  .nl-body { color: #C9C6D0 !important; }
  .nl-muted { color: #9B98A6 !important; }
  .nl-rule { background: #2B2935 !important; border-color: #2B2935 !important; }
  .nl-accent-soft { background: #2A1A1B !important; }
  .nl-band { background: #08070C !important; }
}
@media (max-width: 480px) {
  .nl-container { width: 100% !important; }
  .nl-pad { padding-left: 18px !important; padding-right: 18px !important; }
  .nl-stack { display: block !important; width: 100% !important; max-width: 100% !important; }
  .nl-stack-gap { padding-top: 18px !important; }
  .nl-h1 { font-size: 25px !important; line-height: 32px !important; }
  .nl-hide-sm { display: none !important; }
}
`

/** Fixed widths so Outlook's table engine does not reflow anything. */
export const IMG = {
  hero: 600,
  grid: 300,
  poster: 160,
  posterHeight: 214,
  thumb: 160,
  thumbHeight: 106,
  logo: 44,
} as const
