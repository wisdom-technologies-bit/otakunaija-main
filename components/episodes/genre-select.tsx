"use client"

import { useRouter } from "next/navigation"

type GenreSelectProps = {
  value: string
  label: string
  options: Array<{ value: string; label: string }>
}

/**
 * Select for the long tail of genres. Each option carries the fully built URL
 * so every active filter and sort is preserved when the genre changes.
 */
export function GenreSelect({ value, label, options }: GenreSelectProps) {
  const router = useRouter()

  return (
    <label className="inline-flex items-center gap-2">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(event) => router.push(event.target.value)}
        className="otk-focus min-h-11 rounded-full border border-[var(--otk-border)] bg-[var(--otk-surface)] px-3 text-sm font-medium text-[var(--otk-text)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

export default GenreSelect
