import Link from "next/link"
import { GenreSelect } from "@/components/episodes/genre-select"
import {
  FORMAT_OPTIONS,
  SORT_OPTIONS,
  buildUpcomingHref,
  clearUpcomingFilters,
  hasUpcomingFilters,
  removeUpcomingFilter,
  upcomingFilterChips,
  type UpcomingParams,
} from "@/lib/upcoming-url"

/**
 * Filters for the poster tabs. Every control is a real link, so the URL stays
 * the source of truth and changing one resets paging (lib/upcoming-url.ts).
 */
export function UpcomingToolbar({ params, genres }: { params: UpcomingParams; genres: string[] }) {
  const genreOptions = [
    { value: buildUpcomingHref(params, { genre: "" }), label: "All genres" },
    ...genres.map((genre) => ({ value: buildUpcomingHref(params, { genre }), label: genre })),
  ]
  const chips = upcomingFilterChips(params)

  return (
    <div className="otk-toolbar" data-testid="upcoming-toolbar">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="otk-meta">Format</span>
          <div className="otk-segmented" role="group" aria-label="Filter by format">
            {FORMAT_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={buildUpcomingHref(params, { format: option.value })}
                className="otk-segment otk-focus"
                aria-current={params.format === option.value ? "page" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="otk-meta">Sort</span>
          <div className="otk-segmented" role="group" aria-label="Sort upcoming titles">
            {SORT_OPTIONS.map((option) => (
              <Link
                key={option.value}
                href={buildUpcomingHref(params, { sort: option.value })}
                className="otk-segment otk-focus"
                aria-current={params.sort === option.value ? "page" : undefined}
              >
                {option.label}
              </Link>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <GenreSelect
          value={buildUpcomingHref(params, { genre: params.genre })}
          label="Filter by genre"
          options={genreOptions}
        />
        <Link
          href={buildUpcomingHref(params, { onSite: !params.onSite })}
          className="otk-pill otk-focus"
          aria-pressed={params.onSite}
          data-active={params.onSite}
        >
          On OtakuNaija only
        </Link>
      </div>

      {hasUpcomingFilters(params) ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="otk-meta">Filtered by</span>
          {chips.map((chip) => (
            <Link
              key={chip.key}
              href={removeUpcomingFilter(params, chip.key)}
              className="otk-pill otk-focus"
              aria-label={`Remove ${chip.label} filter`}
            >
              {chip.label}
              <span aria-hidden="true">×</span>
            </Link>
          ))}
          <Link
            href={clearUpcomingFilters(params)}
            className="otk-focus px-2 py-1 text-xs font-bold uppercase tracking-wider text-[var(--otk-accent)]"
          >
            Clear all
          </Link>
        </div>
      ) : null}
    </div>
  )
}

export default UpcomingToolbar
