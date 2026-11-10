export default function Loading() {
  return (
    <div className="min-h-screen bg-background" aria-busy="true" aria-live="polite">
      <div className="mx-auto w-full max-w-7xl px-4 pb-10 md:px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-5">
            <div className="otk-skeleton mx-[-1rem] aspect-video w-[calc(100%+2rem)] rounded-none md:mx-0 md:w-full md:max-w-[1100px] md:rounded-[var(--otk-radius-lg)]" />
            <div className="otk-skeleton h-10 w-full max-w-md rounded-full" />
            <div className="otk-skeleton h-6 w-2/3 max-w-sm" />
            <div className="otk-skeleton h-20 w-full" />
          </div>
          <div className="hidden space-y-4 lg:block">
            <div className="otk-skeleton h-64 w-full" />
            <div className="otk-skeleton h-40 w-full" />
          </div>
        </div>
      </div>
    </div>
  )
}
