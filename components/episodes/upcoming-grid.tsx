"use client"

import Image from "next/image"
import Link from "next/link"
import { Info } from "lucide-react"
import { useState } from "react"
import { Countdown } from "@/components/episodes/countdown"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { daysUntil, type UpcomingItem } from "@/lib/anilist/upcoming"
import { FORMAT_LABELS } from "@/lib/upcoming-url"

const COUNTDOWN_WINDOW_DAYS = 30

export function countdownIso(item: UpcomingItem, now: number): string | null {
  if (!item.startDateIso) return null
  const days = daysUntil(item, new Date(now))
  if (days === null || days < 0 || days > COUNTDOWN_WINDOW_DAYS) return null
  return `${item.startDateIso}T00:00:00Z`
}

function readableSource(source: string | null): string | null {
  if (!source) return null
  return source.charAt(0) + source.slice(1).toLowerCase().replace(/_/g, " ")
}

/**
 * Poster grid for "Next season", "Later" and "Movies". Cards reveal their short
 * description on hover/focus; on touch the little (i) button opens a sheet with
 * the full detail, a trailer link and a Details link.
 */
export function UpcomingGrid({ items, now }: { items: UpcomingItem[]; now: number }) {
  const [selected, setSelected] = useState<UpcomingItem | null>(null)

  if (!items.length) return null

  return (
    <>
      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {items.map((item) => {
          const countdown = countdownIso(item, now)
          return (
            <li key={item.anilistId} className="min-w-0">
              <article className="otk-card group relative">
                <Link href={item.href} className="otk-card-link otk-focus">
                  <div className="otk-card-media relative aspect-[2/3] w-full">
                    {item.coverUrl ? (
                      <Image
                        src={item.coverUrl}
                        alt=""
                        fill
                        sizes="(min-width: 1280px) 18vw, (min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw"
                        className="object-cover"
                        style={item.coverColor ? { backgroundColor: item.coverColor } : undefined}
                      />
                    ) : (
                      <div className="otk-cover-fallback otk-fallback-default">
                        <span className="otk-cover-fallback-label">OtakuNaija</span>
                      </div>
                    )}

                    <span className="otk-chip absolute left-2 top-2 z-[2] bg-[color-mix(in_oklch,var(--otk-bg)_75%,transparent)] backdrop-blur-sm">
                      {FORMAT_LABELS[item.format ?? ""] ?? item.format ?? "Anime"}
                    </span>

                    {/* Hover / keyboard focus reveal, hidden from touch. */}
                    {item.description ? (
                      <p className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] line-clamp-6 bg-gradient-to-t from-black/90 via-black/70 to-transparent p-2.5 text-[11px] leading-snug text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-within:opacity-100 max-lg:hidden">
                        {item.description}
                      </p>
                    ) : null}
                  </div>

                  <div className="otk-card-body">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className={`otk-chip ${item.startDateIso ? "" : "otk-chip-status-upcoming"}`}>
                        {item.startDateIso ? item.startLabel : "TBA"}
                      </span>
                      {item.onSite ? <span className="otk-chip otk-chip-accent">On OtakuNaija</span> : null}
                    </div>

                    <h3 className="otk-card-title line-clamp-2">{item.title}</h3>

                    <p className="otk-meta">
                      {item.genres.slice(0, 2).join(" · ") || "Anime"}
                      {item.studio ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="truncate">{item.studio}</span>
                        </>
                      ) : null}
                    </p>

                    {countdown ? (
                      <div className="mt-1 w-full" data-testid="upcoming-countdown">
                        <Countdown releaseAt={countdown} />
                      </div>
                    ) : null}
                  </div>
                </Link>

                <button
                  type="button"
                  onClick={() => setSelected(item)}
                  aria-label={`More about ${item.title}`}
                  className="otk-focus absolute right-2 top-2 z-[3] inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/25 bg-black/55 text-white backdrop-blur-sm transition-colors hover:bg-black/75"
                >
                  <Info className="h-4 w-4" aria-hidden="true" />
                </button>
              </article>
            </li>
          )
        })}
      </ul>

      <Dialog open={selected !== null} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[85dvh] overflow-y-auto p-0 sm:max-w-lg">
          {selected ? (
            <div>
              <div className="flex gap-4 p-4">
                <div className="relative h-[9.5rem] w-[6.5rem] shrink-0 overflow-hidden rounded-[var(--otk-radius)] bg-[var(--otk-surface-2)]">
                  {selected.coverUrl ? (
                    <Image src={selected.coverUrl} alt="" fill sizes="104px" className="object-cover" />
                  ) : null}
                </div>
                <div className="min-w-0 flex-1">
                  <DialogHeader>
                    <DialogTitle className="text-left text-lg leading-tight">{selected.title}</DialogTitle>
                    <DialogDescription className="text-left">
                      {selected.format ? (FORMAT_LABELS[selected.format] ?? selected.format) : "Anime"}
                      {selected.startDateIso ? ` · ${selected.startLabel}` : " · TBA"}
                      {selected.onSite ? " · On OtakuNaija" : ""}
                    </DialogDescription>
                  </DialogHeader>
                  <dl className="otk-meta mt-3 gap-x-3 gap-y-1">
                    {selected.genres.length ? (
                      <div className="flex gap-1">
                        <dt className="font-semibold">Genres</dt>
                        <dd>{selected.genres.slice(0, 4).join(", ")}</dd>
                      </div>
                    ) : null}
                    {selected.studio ? (
                      <div className="flex gap-1">
                        <dt className="font-semibold">Studio</dt>
                        <dd>{selected.studio}</dd>
                      </div>
                    ) : null}
                    {selected.source ? (
                      <div className="flex gap-1">
                        <dt className="font-semibold">Source</dt>
                        <dd>{readableSource(selected.source)}</dd>
                      </div>
                    ) : null}
                    <div className="flex gap-1">
                      <dt className="font-semibold">Episodes</dt>
                      <dd>{selected.episodes ? String(selected.episodes) : "TBA"}</dd>
                    </div>
                  </dl>
                </div>
              </div>

              {selected.description ? (
                <p className="px-4 pb-2 text-sm leading-relaxed text-[var(--otk-text-dim)]">
                  {selected.description}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2 px-4 pb-5 pt-2">
                {selected.trailerUrl ? (
                  <a
                    href={selected.trailerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="otk-pill otk-focus"
                  >
                    Watch trailer
                  </a>
                ) : null}
                <Link href={selected.onSite && selected.seriesSlug ? `/episodes/${selected.seriesSlug}` : selected.externalUrl ?? selected.href} className="otk-pill otk-focus" data-active="true">
                  Details
                </Link>
                <a
                  href={selected.externalUrl ?? selected.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="otk-pill otk-focus"
                >
                  On AniList
                </a>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}

export default UpcomingGrid
