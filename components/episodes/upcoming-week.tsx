"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useRef } from "react"
import { UpcomingAirTime } from "@/components/episodes/upcoming-air-time"
import { FORMAT_LABELS } from "@/lib/upcoming-url"
import type { AiringItem } from "@/lib/anilist/upcoming-store"

/**
 * Airing this week: a day-per-column schedule on desktop, a stacked list on
 * phones. Today is highlighted and scrolled into view on small screens.
 */
export function UpcomingWeek({
  days,
  timeZoneLabel,
}: {
  days: Array<{ key: string; label: string; weekday: string; dateLabel: string; isToday: boolean; items: AiringItem[] }>
  timeZoneLabel: string
}) {
  const todayRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const node = todayRef.current
    if (!node) return
    if (typeof window === "undefined") return
    if (!window.matchMedia("(max-width: 1023px)").matches) return

    const stickyOffset = 72
    const rect = node.getBoundingClientRect()
    // Once today's column is comfortably on screen there is nothing to do.
    if (rect.top >= stickyOffset && rect.top <= window.innerHeight * 0.4) return
    if (rect.top <= stickyOffset && rect.bottom > stickyOffset) return

    const target = Math.max(0, window.scrollY + rect.top - stickyOffset - 8)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    window.scrollTo({ top: target, behavior: reduce ? "auto" : "smooth" })
  }, [])

  if (!days.length) {
    return (
      <div className="otk-empty">
        <p className="text-lg font-bold text-[var(--otk-text)]">Nothing scheduled in the next 8 days</p>
        <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
          AniList has not listed any air times for this window yet. Check the next season tab for what is coming.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="otk-meta mb-3">
        Times shown in your time zone, {timeZoneLabel} when we cannot detect it.
      </p>
      <div className="grid gap-3 lg:grid-cols-7">
        {days.map((day) => (
          <div
            key={day.key}
            ref={day.isToday ? todayRef : undefined}
            data-day={day.key}
            data-today={day.isToday ? "true" : undefined}
            className={`min-w-0 rounded-[var(--otk-radius)] border p-2.5 ${
              day.isToday
                ? "border-[var(--otk-accent)] bg-[color-mix(in_oklch,var(--otk-accent)_9%,var(--otk-surface))]"
                : "border-[var(--otk-border)] bg-[var(--otk-surface)]"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2 border-b border-[var(--otk-border)] pb-2">
              <div className="min-w-0">
                <p
                  className={`truncate text-xs font-bold uppercase tracking-[0.12em] ${
                    day.isToday ? "text-[var(--otk-accent)]" : "text-[var(--otk-text)]"
                  }`}
                >
                  {day.label}
                </p>
                <p className="otk-meta mt-0.5">
                  <span>{day.dateLabel}</span>
                </p>
              </div>
              <span className="otk-chip shrink-0">{day.items.length}</span>
            </div>

            {day.items.length === 0 ? (
              <p className="otk-meta py-3">No episodes scheduled.</p>
            ) : (
              <ul className="mt-2 space-y-1.5">
                {day.items.map((item) => (
                  <li key={`${item.anilistId}-${item.episode}`} className="min-w-0">
                    <Link
                      href={item.href}
                      className="otk-focus group flex min-h-11 min-w-0 items-start gap-2 rounded-[calc(var(--otk-radius)-0.25rem)] p-1 hover:bg-[var(--otk-surface-2)]"
                    >
                      <span className="relative h-[3.75rem] w-[2.5rem] shrink-0 overflow-hidden rounded bg-[var(--otk-surface-2)]">
                        {item.coverUrl ? (
                          <Image
                            src={item.coverUrl}
                            alt=""
                            fill
                            sizes="40px"
                            className="object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        <UpcomingAirTime
                          airingAt={item.airingAt}
                          className="block text-[11px] font-bold tabular-nums text-[var(--otk-accent)]"
                        />
                        <span className="mt-0.5 block truncate text-xs font-semibold text-[var(--otk-text)] group-hover:text-[var(--otk-accent)]">
                          {item.title}
                        </span>
                        <span className="otk-meta mt-0.5 flex-wrap gap-1">
                          <span>Ep {item.episode}</span>
                          <span aria-hidden="true">·</span>
                          <span>{FORMAT_LABELS[item.format ?? ""] ?? item.format ?? "Anime"}</span>
                        </span>
                        {item.onSite ? (
                          <span className="otk-chip otk-chip-accent mt-1">On OtakuNaija</span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

export default UpcomingWeek
