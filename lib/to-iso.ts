export function toISO(value: Date | string | number | null | undefined): string | null {
  if (value === null || value === undefined) return null

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}
