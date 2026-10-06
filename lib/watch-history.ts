'use client'

export type HistoryEntry = {
  seriesSlug: string
  episodeSlug: string
  seriesTitle: string
  epNumber: number
  thumb: string | null
  positionSeconds: number
  durationSeconds: number
  updatedAt: number
}

const HISTORY_KEY = 'otn_history'
const HISTORY_CHANGED_EVENT = 'otn-history-changed'
const MAX_HISTORY_ENTRIES = 5

function isValidEntry(value: unknown): value is HistoryEntry {
  if (!value || typeof value !== 'object') return false
  const entry = value as Record<string, unknown>
  return (
    typeof entry.seriesSlug === 'string' &&
    typeof entry.episodeSlug === 'string' &&
    typeof entry.seriesTitle === 'string' &&
    typeof entry.epNumber === 'number' && Number.isFinite(entry.epNumber) &&
    (typeof entry.thumb === 'string' || entry.thumb === null) &&
    typeof entry.positionSeconds === 'number' && Number.isFinite(entry.positionSeconds) &&
    typeof entry.durationSeconds === 'number' && Number.isFinite(entry.durationSeconds) &&
    typeof entry.updatedAt === 'number' && Number.isFinite(entry.updatedAt)
  )
}

function notifyChange(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(HISTORY_CHANGED_EVENT))
}

export function getHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(HISTORY_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isValidEntry).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, MAX_HISTORY_ENTRIES)
  } catch {
    return []
  }
}

export function saveProgress(entry: HistoryEntry): void {
  if (typeof window === 'undefined') return

  try {
    const nextEntry = { ...entry, updatedAt: Date.now() }
    const entries = [nextEntry, ...getHistory().filter((item) => item.episodeSlug !== entry.episodeSlug)]
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_HISTORY_ENTRIES)))
    notifyChange()
  } catch {
    // Storage can be unavailable or full; history is optional and must never interrupt playback.
  }
}

export function removeEntry(episodeSlug: string): void {
  if (typeof window === 'undefined') return

  try {
    const entries = getHistory().filter((entry) => entry.episodeSlug !== episodeSlug)
    window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries))
    notifyChange()
  } catch {
    // Storage can be unavailable; history is optional.
  }
}

export function clearHistory(): void {
  if (typeof window === 'undefined') return

  try {
    window.localStorage.removeItem(HISTORY_KEY)
    notifyChange()
  } catch {
    // Storage can be unavailable; history is optional.
  }
}

export function getEntry(episodeSlug: string): HistoryEntry | null {
  if (typeof window === 'undefined') return null
  return getHistory().find((entry) => entry.episodeSlug === episodeSlug) ?? null
}

export { HISTORY_CHANGED_EVENT }

export default getHistory
