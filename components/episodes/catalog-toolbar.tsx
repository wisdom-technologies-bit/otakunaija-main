import Link from "next/link"
import { GenreSelect } from "@/components/episodes/genre-select"
import { activeFilterChips, buildHref, clearFiltersHref, hasActiveFilters } from "@/lib/listing-url"

type Option = { value: string; label: string }

type CatalogToolbarProps = {
  basePath: string
  params: Record<string, string | undefined>
  statusKey: string
  statusLabel: string
  statusOptions: Option[]
  genres?: string[]
  genreLabel?: string
  sortOptions?: Option[]
  sortLabel?: string
}

/**
 * One filter toolbar for every catalogue page: a status segmented control, the
 * genre chips (scrollable on phones, wrapping on desktop) plus a select for the
 * long tail, sort, and removable active-filter chips with Clear all.
 */
export function CatalogToolbar({
  basePath,
  params,
  statusKey,
  statusLabel,
  statusOptions,
  genres = [],
  genreLabel = "Genre",
  sortOptions,
  sortLabel = "Sort",
}: CatalogToolbarProps) {
  const current = params
  const activeStatus = params[statusKey] ?? "all"
  const genre = params.genre ?? ""
  const chips = activeFilterChips(current, { [statusKey]: statusLabel, genre: genreLabel, sort: sortLabel })
  const filtered = hasActiveFilters(current)

  const genreOptions = [
    { value: buildHref(basePath, current, { genre: undefined }), label: "All genres" },
    ...genres.map((item) => ({ value: buildHref(basePath, current, { genre: item }), label: item })),
  ]

  return (
    <div className="otk-toolbar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="otk-segmented" role="group" aria-label={`Filter by ${statusLabel.toLowerCase()}`}>
          {statusOptions.map((option) => {
            const active = activeStatus === option.value
            return (
              <Link
                key={option.value}
                href={buildHref(basePath, current, { [statusKey]: option.value })}
                className="otk-segment otk-focus"
                aria-current={active ? "page" : undefined}
              >
                {option.label}
              </Link>
            )
          })}
        </div>

        {sortOptions ? (
          <div className="flex items-center gap-2">
            <span className="otk-meta">{sortLabel}</span>
            <div className="otk-segmented" role="group" aria-label={`Sort by ${sortLabel.toLowerCase()}`}>
              {sortOptions.map((option) => {
                const active = (params.sort ?? sortOptions[0].value) === option.value
                return (
                  <Link
                    key={option.value}
                    href={buildHref(basePath, current, { sort: option.value })}
                    className="otk-segment otk-focus"
                    aria-current={active ? "page" : undefined}
                  >
                    {option.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ) : null}
      </div>

      {genres.length > 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <div
            className="otk-chip-scroller min-w-0 grow"
            role="group"
            aria-label={`Filter by ${genreLabel.toLowerCase()}`}
          >
            <Link
              href={buildHref(basePath, current, { genre: undefined })}
              className="otk-pill otk-focus"
              aria-current={!genre ? "page" : undefined}
              data-active={!genre}
            >
              All
            </Link>
            {genres.map((item) => (
              <Link
                key={item}
                href={buildHref(basePath, current, { genre: item })}
                className="otk-pill otk-focus"
                aria-current={genre === item ? "page" : undefined}
                data-active={genre === item}
              >
                {item}
              </Link>
            ))}
          </div>
          <GenreSelect value={genreOptions[0].value} label="Choose a genre" options={genreOptions} />
        </div>
      ) : null}

      {filtered ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="otk-meta">Filtered by</span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={buildHref(basePath, current, { [chip.key]: undefined })}
              className="otk-pill otk-focus"
              aria-label={`Remove ${chip.label} filter: ${chip.value}`}
            >
              {chip.label}: {chip.value}
              <span aria-hidden="true">×</span>
            </Link>
          ))}
          <Link
            href={clearFiltersHref(basePath)}
            className="otk-focus px-2 py-1 text-xs font-bold uppercase tracking-wider text-[var(--otk-accent)]"
          >
            Clear all
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default CatalogToolbar
