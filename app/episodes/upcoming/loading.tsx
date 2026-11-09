import { SeriesCardSkeleton } from "@/components/episodes/skeletons"

/** Skeleton that matches the poster grid and day-column layout. */
export default function UpcomingAnimeLoading() {
  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <div className="border-b border-border/60">
        <div className="mx-auto h-[4.25rem] max-w-7xl" />
      </div>
      <main className="otk-page mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <div className="otk-skeleton mb-3 h-3 w-24" />
        <div className="otk-skeleton h-10 w-2/3 max-w-md md:h-14" />
        <div className="otk-skeleton mt-4 h-3 w-full max-w-xl" />
        <div className="otk-skeleton mt-2 h-3 w-40" />

        <div className="mt-6 flex gap-2 overflow-hidden">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="otk-skeleton h-11 w-32 shrink-0 rounded-full" />
          ))}
        </div>

        <div className="otk-skeleton mt-6 h-28 w-full" />

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 10 }).map((_, index) => (
            <SeriesCardSkeleton key={index} />
          ))}
        </div>
      </main>
    </div>
  )
}
