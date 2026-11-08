import { LAGOS_TIME_ZONE } from "./format-date"

export type DayGroupKey = "today" | "yesterday" | "week" | "earlier"

export type DayGroup<T> = { key: DayGroupKey; label: string; items: T[] }

const LABELS: Record<DayGroupKey, string> = {
  today: "Today",
  yesterday: "Yesterday",
  week: "This week",
  earlier: "Earlier",
}

const DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: LAGOS_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})

function dayKey(date: Date): string {
  return DAY_FORMATTER.format(date)
}

function daysBetween(a: string, b: string): number {
  const first = Date.parse(`${a}T00:00:00Z`)
  const second = Date.parse(`${b}T00:00:00Z`)
  if (Number.isNaN(first) || Number.isNaN(second)) return Number.POSITIVE_INFINITY
  return Math.round((second - first) / 86_400_000)
}

/** Groups releases into Today / Yesterday / This week / Earlier (Africa/Lagos). */
export function groupByReleaseDay<T>(
  items: T[],
  getDate: (item: T) => string | Date | null | undefined,
  now: Date = new Date(),
): DayGroup<T>[] {
  const todayKey = dayKey(now)
  const buckets: Record<DayGroupKey, T[]> = { today: [], yesterday: [], week: [], earlier: [] }

  for (const item of items) {
    const raw = getDate(item)
    const date = raw ? (raw instanceof Date ? raw : new Date(raw)) : null
    if (!date || Number.isNaN(date.getTime())) {
      buckets.earlier.push(item)
      continue
    }
    const diff = daysBetween(dayKey(date), todayKey)
    if (diff <= 0) buckets.today.push(item)
    else if (diff === 1) buckets.yesterday.push(item)
    else if (diff < 7) buckets.week.push(item)
    else buckets.earlier.push(item)
  }

  return (Object.keys(buckets) as DayGroupKey[])
    .filter((key) => buckets[key].length > 0)
    .map((key) => ({ key, label: LABELS[key], items: buckets[key] }))
}
