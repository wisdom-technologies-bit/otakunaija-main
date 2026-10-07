const LAGOS_TIME_ZONE = 'Africa/Lagos'

function asDate(input: string | Date) {
  const date = input instanceof Date ? input : new Date(input)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatReleaseDate(input: string | Date): string {
  const date = asDate(input)
  if (!date) return ''

  return new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

export function formatReleaseDateTime(input: string | Date): string {
  const date = asDate(input)
  if (!date) return ''

  return new Intl.DateTimeFormat('en-US', {
    timeZone: LAGOS_TIME_ZONE,
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export { LAGOS_TIME_ZONE }

export function formatDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatPublishedDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatPublishedDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatEpisodeDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatEpisodeDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatPostDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatPostDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatShortDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatLongDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatDateWithTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatReleaseDateOnly(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatReleaseDateAndTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatDisplayDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatDisplayDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatCalendarDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatCalendarDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatDateLabel(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatDateTimeLabel(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatReadableDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatReadableDateTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatTimestamp(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatTimestampDate(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatTimestampTime(date: string | Date): string {
  return formatReleaseDateTime(date)
}

export function formatDateForDisplay(date: string | Date): string {
  return formatReleaseDate(date)
}

export function formatDateTimeForDisplay(date: string | Date): string {
  return formatReleaseDateTime(date)
}
