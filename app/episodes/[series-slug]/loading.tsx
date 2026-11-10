export default function Loading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite">
      <div className="otk-series-hero">
        <div className="otk-series-hero-inner">
          <div className="otk-skeleton hidden aspect-[2/3] w-[216px] md:block" />
          <div className="min-w-0 flex-1 space-y-3">
            <div className="otk-skeleton h-7 w-2/3 max-w-sm" />
            <div className="otk-skeleton h-4 w-1/2 max-w-xs" />
            <div className="otk-skeleton h-4 w-1/3 max-w-[12rem]" />
            <div className="otk-skeleton h-10 w-40 rounded-full" />
          </div>
        </div>
      </div>
      <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="space-y-4">
            <div className="otk-skeleton h-9 w-40 rounded-full" />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="otk-skeleton aspect-video w-full" />
              ))}
            </div>
          </div>
          <div className="space-y-4">
            <div className="otk-skeleton h-40 w-full" />
            <div className="otk-skeleton h-24 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
