export function SeriesCardSkeleton() {
  return (
    <div className="h-full overflow-hidden rounded-lg border border-border/60 bg-card animate-pulse">
      {/* Image placeholder */}
      <div className="aspect-video w-full bg-muted" />

      {/* Content */}
      <div className="flex flex-col gap-2 p-4">
        <div className="h-5 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
        <div className="mt-2 h-3 w-full rounded bg-muted" />
        <div className="h-3 w-1/3 rounded bg-muted" />
      </div>
    </div>
  )
}

export function SeriesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <SeriesCardSkeleton key={i} />
      ))}
    </div>
  )
}

export function EpisodeRowSkeleton() {
  return (
    <div className="flex gap-4 rounded-lg border border-border/40 p-3 animate-pulse">
      <div className="h-20 w-32 flex-shrink-0 rounded bg-muted" />
      <div className="flex-1">
        <div className="h-4 w-2/3 rounded bg-muted mb-2" />
        <div className="h-3 w-full rounded bg-muted mb-2" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  )
}

export function EpisodeListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <EpisodeRowSkeleton key={i} />
      ))}
    </div>
  )
}
