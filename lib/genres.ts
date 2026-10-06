export function splitGenres(value: string | null | undefined): string[] {
  const seen = new Set<string>()
  const genres: string[] = []

  for (const part of value?.split(',') ?? []) {
    const genre = part.trim()
    const key = genre.toLowerCase()
    if (genre && !seen.has(key)) {
      seen.add(key)
      genres.push(genre)
    }
  }

  return genres
}

export function normalizeGenreParam(value: string | null | undefined): string {
  return value?.trim() ?? ''
}

export function genreKey(value: string): string {
  return value.toLowerCase()
}

export function sortGenres(genres: string[]): string[] {
  return genres.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }))
}

export function uniqueGenres(values: string[]): string[] {
  const seen = new Set<string>()
  return values.filter((value) => {
    const key = genreKey(value)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}
