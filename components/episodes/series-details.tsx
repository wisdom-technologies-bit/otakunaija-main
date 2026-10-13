import { AlertTriangle, ExternalLink } from 'lucide-react'
import type { AnimeScheduleInfo } from '@/lib/animeschedule'

export type DetailsSection = 'banner' | 'about' | 'watch' | 'related'

const timeWAT = (iso: string | null) =>
  iso
    ? new Intl.DateTimeFormat('en-NG', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Africa/Lagos',
      }).format(new Date(iso))
    : null

const pretty = (slug: string) => slug.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())

export function SeriesDetails({ info, section }: { info: AnimeScheduleInfo; section: DetailsSection }) {
  if (section === 'banner') {
    if (!info.delayText) return null
    return (
      <div className="flex gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-500" />
        <div>
          <p className="text-sm font-semibold text-foreground">Currently on break</p>
          <p className="text-sm text-foreground/80">{info.delayText}</p>
        </div>
      </div>
    )
  }

  if (section === 'about') {
    const { stats } = info
    const dropRate = stats && stats.tracked > 0 ? Math.round((stats.dropped / stats.tracked) * 100) : null
    const facts = [
      ['Season', info.seasonTitle],
      ['Studio', info.studios.map((s) => s.name).join(', ') || null],
      ['Source', info.sources.map((s) => s.name).join(', ') || null],
      ['Format', info.mediaTypes.map((s) => s.name).join(', ') || null],
      ['Runtime', info.lengthMin ? `${info.lengthMin} min` : null],
      ['Japanese title', info.native],
      ['Romaji', info.romaji],
    ].filter(([, v]) => v) as [string, string][]

    return (
      <div className="space-y-6">
        {stats && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              ['Score', `${stats.score.toFixed(1)}`, 'out of 100'],
              ['Ratings', stats.ratingCount.toLocaleString('en-NG'), 'users'],
              ['Tracked', stats.tracked.toLocaleString('en-NG'), 'on lists'],
              ['Drop rate', dropRate !== null ? `${dropRate}%` : '—', `${stats.dropped.toLocaleString('en-NG')} dropped`],
            ].map(([label, value, sub]) => (
              <div key={label} className="rounded-xl border border-border bg-card p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground">{value}</p>
                <p className="text-[11px] text-muted-foreground">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {facts.length > 0 && (
          <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-2">
            {facts.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 text-sm">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="text-right font-medium text-foreground">{v}</dd>
              </div>
            ))}
          </dl>
        )}

        {info.notes && (
          <p className="whitespace-pre-line rounded-xl border border-border bg-card p-4 text-sm text-foreground/80">
            {info.notes}
          </p>
        )}

        {info.links.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {info.links.map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noopener noreferrer nofollow"
                className="text-xs text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
              >
                {l.label}
              </a>
            ))}
          </div>
        )}

        <p className="text-[11px] text-muted-foreground">
          Schedule data from{' '}
          <a href="https://animeschedule.net" target="_blank" rel="noopener noreferrer" className="underline">
            AnimeSchedule.net
          </a>
          .
        </p>
      </div>
    )
  }

  if (section === 'watch') {
    const times = [
      ['Japan (raw)', timeWAT(info.jpnTime)],
      ['English sub', timeWAT(info.subTime)],
      ['English dub', timeWAT(info.dubTime)],
    ].filter(([, t]) => t) as [string, string][]

    return (
      <div className="space-y-6">
        {times.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold text-foreground">Air time (Nigeria, WAT)</h3>
            <div className="flex flex-wrap gap-2">
              {times.map(([label, t]) => (
                <span key={label} className="rounded-full border border-border px-3 py-1 text-xs text-foreground/80">
                  {label}: <span className="font-semibold text-foreground">{t}</span>
                </span>
              ))}
            </div>
          </div>
        )}
        {info.streams.length > 0 && (
          <div className="rounded-xl border border-border bg-card p-4">
            <h3 className="mb-2 text-sm font-bold text-foreground">Where to watch</h3>
            <div className="flex flex-wrap gap-2">
              {info.streams.map((s) => (
                <a
                  key={s.platform + s.url}
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer nofollow sponsored"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground/80 hover:border-primary hover:text-primary"
                >
                  {s.name} <ExternalLink className="h-3 w-3" />
                </a>
              ))}
            </div>
            <p className="mt-2 text-[11px] text-muted-foreground">Availability varies by country.</p>
          </div>
        )}
      </div>
    )
  }

  // related
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="space-y-4">
        {info.related.map((g) => (
          <div key={g.label}>
            <p className="mb-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">{g.label}</p>
            <div className="flex flex-wrap gap-1.5">
              {g.slugs.slice(0, 12).map((slug) => (
                <a
                  key={slug}
                  href={`https://animeschedule.net/anime/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-border px-2.5 py-0.5 text-[11px] text-foreground/80 hover:border-primary hover:text-primary"
                >
                  {pretty(slug)}
                </a>
              ))}
              {g.slugs.length > 12 && (
                <span className="px-1 text-[11px] text-muted-foreground">+{g.slugs.length - 12} more</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
