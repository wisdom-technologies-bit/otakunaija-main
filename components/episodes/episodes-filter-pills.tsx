import Link from 'next/link'
import { Flame } from 'lucide-react'

interface EpisodesFilterPillsProps {
  genres: string[]
  activeGenre?: string
  activeStatus?: string
  basePath?: string
}

export function EpisodesFilterPills({ genres, activeGenre, activeStatus, basePath = '/episodes' }: EpisodesFilterPillsProps) {
  const filterHref = (params: Record<string, string | undefined>) => {
    const search = new URLSearchParams()
    if (activeStatus) search.set('status', activeStatus)
    if (activeGenre) search.set('genre', activeGenre)
    Object.entries(params).forEach(([key, value]) => value ? search.set(key, value) : search.delete(key))
    const query = search.toString()
    return `${basePath}${query ? `?${query}` : ''}`
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Link
        href={basePath}
        className={`inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          !activeGenre
            ? 'border border-primary bg-primary/10 text-primary'
            : 'border border-border bg-card text-foreground/80 hover:border-primary hover:text-primary'
        }`}
      >
        <Flame className="h-3.5 w-3.5" /> Trending
      </Link>
      {genres.slice(0, 4).map((g) => (
        <Link
          key={g}
          href={filterHref({ genre: g })}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            activeGenre === g
              ? 'border border-primary bg-primary/10 text-primary'
              : 'border border-border bg-card text-foreground/80 hover:border-primary hover:text-primary'
          }`}
        >
          {g}
        </Link>
      ))}
      {genres.length > 4 && (
        <Link
          href={basePath}
          className="rounded-full border border-border bg-card px-4 py-1.5 text-sm font-medium text-foreground/80 hover:border-primary hover:text-primary"
        >
          More
        </Link>
      )}
    </div>
  )
}
