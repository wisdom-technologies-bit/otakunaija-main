/**
 * Presentation helpers for series that have not started airing yet.
 *
 * Pure and dependency-free so both server pages and client cards can use them,
 * and so the "Coming {date} / TBA" wording is unit-tested in one place.
 */

export type UpcomingSeriesFields = {
  status?: string | null
  startDate?: string | Date | null
  startYear?: number | null
  startMonth?: number | null
  episodesTotal?: number | null
  trailerSite?: string | null
  trailerId?: string | null
}

export const SERIES_STATUS_LABELS: Record<string, string> = {
  ongoing: "Ongoing",
  completed: "Completed",
  upcoming: "Upcoming",
}

export const SERIES_STATUS_CLASSES: Record<string, string> = {
  ongoing: "otk-chip-status-ongoing",
  completed: "otk-chip-status-completed",
  upcoming: "otk-chip-status-upcoming",
}

export function isUpcomingSeries(series: { status?: string | null } | null | undefined): boolean {
  return series?.status === "upcoming"
}

export function seriesStatusLabel(status: string | null | undefined): string {
  if (!status) return "Ongoing"
  return SERIES_STATUS_LABELS[status] ?? status
}

export function seriesStatusClass(status: string | null | undefined): string {
  return SERIES_STATUS_CLASSES[status ?? "ongoing"] ?? ""
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
]

function isoDate(value: string | Date | null | undefined): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 10)
  if (typeof value !== "string") return null
  const match = value.trim().match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

/**
 * "Mar 12, 2027" when the full date is known, "Mar 2027" when only the month is,
 * "2027" when only the year is, and "TBA" when nothing is. Never invents a day.
 */
export function seriesStartLabel(series: UpcomingSeriesFields | null | undefined): string {
  if (!series) return "TBA"

  const iso = isoDate(series.startDate)
  if (iso) {
    const [year, month, day] = iso.split("-")
    const monthName = MONTHS[Number(month) - 1]
    if (monthName) return `${monthName} ${Number(day)}, ${year}`
    return year ?? "TBA"
  }

  const month = series.startMonth
  const year = series.startYear

  if (year && month && month >= 1 && month <= 12) return `${MONTHS[month - 1]} ${year}`
  if (year) return String(year)
  return "TBA"
}

/** "Coming Mar 12, 2027" / "Coming TBA". */
export function seriesComingLabel(series: UpcomingSeriesFields | null | undefined): string {
  return `Coming ${seriesStartLabel(series)}`
}

/** YouTube (or other) trailer URL, when AniList gave us one. */
export function seriesTrailerUrl(series: UpcomingSeriesFields | null | undefined): string | null {
  if (!series?.trailerSite || !series.trailerId) return null
  const site = series.trailerSite.toLowerCase()
  if (site === "youtube") return `https://www.youtube.com/watch?v=${series.trailerId}`
  if (site === "dailymotion") return `https://www.dailymotion.com/video/${series.trailerId}`
  return null
}

/** Episode count for an upcoming series, when the play service told us. */
export function upcomingEpisodeCount(series: UpcomingSeriesFields | null | undefined): number | null {
  const count = series?.episodesTotal
  return typeof count === "number" && Number.isFinite(count) && count > 0 ? count : null
}
