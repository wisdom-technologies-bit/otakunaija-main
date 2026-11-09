import { cn } from "@/lib/utils"

/** Poster skeleton matching the 2:3 catalogue card. */
export function SeriesCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="otk-skeleton aspect-[2/3] w-full" />
      <div className="otk-skeleton mt-2 h-3.5 w-4/5" />
      <div className="otk-skeleton mt-1.5 h-3 w-2/5" />
    </div>
  )
}

export function SeriesGridSkeleton({ count = 10 }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {Array.from({ length: count }).map((_, index) => (
        <SeriesCardSkeleton key={index} />
      ))}
    </div>
  )
}

/** Episode skeleton matching the 16:9 episode card. */
export function EpisodeCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="otk-skeleton aspect-video w-full" />
      <div className="otk-skeleton mt-2 h-3.5 w-4/5" />
      <div className="otk-skeleton mt-1.5 h-3 w-1/2" />
    </div>
  )
}

export function EpisodeGridSkeleton({ count = 8 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <EpisodeCardSkeleton key={index} />
      ))}
    </div>
  )
}

export function EpisodeRowSkeleton() {
  return (
    <div className="flex gap-4 rounded-lg border border-[var(--otk-border)] p-3">
      <div className="otk-skeleton aspect-video w-32 flex-shrink-0" />
      <div className="flex-1">
        <div className="otk-skeleton mb-2 h-4 w-2/3" />
        <div className="otk-skeleton mb-2 h-3 w-full" />
        <div className="otk-skeleton h-3 w-1/2" />
      </div>
    </div>
  )
}

export function EpisodeListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 6 }).map((_, index) => (
        <EpisodeRowSkeleton key={index} />
      ))}
    </div>
  )
}
