/**
 * Layout choice and per-issue visual variation.
 *
 * Two guarantees the tests hold us to:
 *   1. The same (content, weekday, seed) always yields the same layout and the
 *      same variation, so re-rendering an issue is byte-identical.
 *   2. Consecutive issue dates never produce identical variations, so a week of
 *      lead-story issues does not look like one email sent six times.
 *
 * Nothing here touches React or the network.
 */

import type { IssueContent } from "./types"

export type LayoutId =
  | "lead-story"
  | "episode-drop"
  | "week-ahead"
  | "weekend-watch"
  | "roundup"
  | "quiet-day"

export const LAYOUT_IDS: LayoutId[] = [
  "lead-story",
  "episode-drop",
  "week-ahead",
  "weekend-watch",
  "roundup",
  "quiet-day",
]

export type CropStyle = "wide" | "tall" | "square"
export type DividerStyle = "hairline" | "dots" | "accent-rule"
export type AccentPlacement = "left" | "top" | "underline"
export type ButtonStyle = "solid" | "outline" | "arrow"
export type ModuleOrder = "news-first" | "watch-first"

export type LayoutVariant = {
  crop: CropStyle
  divider: DividerStyle
  accent: AccentPlacement
  button: ButtonStyle
  order: ModuleOrder
  /** The value the variation was derived from; handy in tests and payloads. */
  seed: number
}

export const DEFAULT_VARIANT: LayoutVariant = {
  crop: "wide",
  divider: "hairline",
  accent: "left",
  button: "solid",
  order: "news-first",
  seed: 0,
}

/** Below this an issue is not worth the daily-email treatment. */
export const QUIET_CONTENT_THRESHOLD = 5
/** Six or more new episodes earns the poster wall. */
export const EPISODE_DROP_THRESHOLD = 6

/**
 * Days since the epoch for a YYYY-MM-DD issue date, which makes the issue date
 * itself the variation seed (no randomness anywhere in the pipeline).
 */
export function seedFromDate(issueDate: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(issueDate)
  if (!match) return 0
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Math.floor(utc / 86_400_000)
}

/** Small, well-mixed 32-bit hash. Deterministic across machines. */
export function mix32(seed: number, salt: number): number {
  let value = (seed * 0x9e3779b1 + salt * 0x85ebca6b) >>> 0
  value ^= value >>> 16
  value = Math.imul(value, 0x7feb352d) >>> 0
  value ^= value >>> 15
  value = Math.imul(value, 0x846ca68b) >>> 0
  value ^= value >>> 16
  return value >>> 0
}

function pick<T>(list: readonly T[], seed: number, salt: number): T {
  return list[mix32(seed, salt) % list.length]
}

const CROPS: CropStyle[] = ["wide", "tall", "square"]
const DIVIDERS: DividerStyle[] = ["hairline", "dots", "accent-rule"]
const ACCENTS: AccentPlacement[] = ["left", "top", "underline"]
const BUTTONS: ButtonStyle[] = ["solid", "outline", "arrow"]
const ORDERS: ModuleOrder[] = ["news-first", "watch-first"]

function rawVariant(seed: number): LayoutVariant {
  return {
    crop: pick(CROPS, seed, 11),
    divider: pick(DIVIDERS, seed, 23),
    accent: pick(ACCENTS, seed, 37),
    button: pick(BUTTONS, seed, 41),
    order: pick(ORDERS, seed, 53),
    seed,
  }
}

function identical(a: LayoutVariant, b: LayoutVariant): boolean {
  return (
    a.crop === b.crop &&
    a.divider === b.divider &&
    a.accent === b.accent &&
    a.button === b.button &&
    a.order === b.order
  )
}

/**
 * Variation for the issue date. The one correction applied afterwards is a crop
 * bump when the raw pick would repeat yesterday's combination exactly, which is
 * what makes "two consecutive issues never look identical" a guarantee rather
 * than a probability.
 */
export function variantFor(seed: number): LayoutVariant {
  const variant = rawVariant(seed)
  const previous = rawVariant(seed - 1)
  if (!identical(variant, previous)) return variant

  const nextCrop = CROPS[(CROPS.indexOf(variant.crop) + 1) % CROPS.length]
  return { ...variant, crop: nextCrop }
}

export type LayoutChoice = {
  layout: LayoutId
  variant: LayoutVariant
  /** Why this layout won; surfaced in the cron JSON and the admin UI. */
  reason: string
}

function episodeCount(content: IssueContent): number {
  return content.counts?.episodes ?? content.episodes.length
}

/**
 * Precedence, in order:
 *   1. Too little to say            -> quiet-day
 *   2. Monday                       -> week-ahead
 *   3. Friday                       -> weekend-watch
 *   4. Sunday                       -> roundup
 *   5. Six or more new episodes     -> episode-drop
 *   6. Everything else              -> lead-story
 */
export function chooseLayout(content: IssueContent, weekday: number, seed: number): LayoutChoice {
  const variant = variantFor(seed)
  const meaningful = content.meaningfulItems ?? 0
  const episodes = episodeCount(content)

  if (meaningful < QUIET_CONTENT_THRESHOLD) {
    return { layout: "quiet-day", variant, reason: `quiet-day:${meaningful}-items` }
  }
  if (weekday === 1) return { layout: "week-ahead", variant, reason: "monday-schedule" }
  if (weekday === 5) return { layout: "weekend-watch", variant, reason: "friday-planning" }
  if (weekday === 0) return { layout: "roundup", variant, reason: "sunday-review" }
  if (episodes >= EPISODE_DROP_THRESHOLD) {
    return { layout: "episode-drop", variant, reason: `episode-drop:${episodes}-episodes` }
  }
  return { layout: "lead-story", variant, reason: "lead-story" }
}

export type LayoutHints = {
  crop: { width: number; height: number }
  dividerClass: DividerStyle
  accent: AccentPlacement
  button: ButtonStyle
  order: ModuleOrder
}
