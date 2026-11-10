import type { Metadata } from "next"
import Link from "next/link"
import { SiteHeader } from "@/components/site-header"
import { SiteFooter } from "@/components/site-footer"
import { CatalogHeader } from "@/components/episodes/catalog-header"
import { CatalogPagination } from "@/components/episodes/catalog-pagination"
import { UpcomingGrid } from "@/components/episodes/upcoming-grid"
import { UpcomingTabs } from "@/components/episodes/upcoming-tabs"
import { UpcomingToolbar } from "@/components/episodes/upcoming-toolbar"
import { UpcomingWeek } from "@/components/episodes/upcoming-week"
import {
  getAiringThisWeek,
  getUpcomingBySeason,
  getUpcomingCacheState,
  getUpcomingFurtherOut,
  getUpcomingMovies,
} from "@/lib/anilist/upcoming-store"
import { formatRelativeAge, groupByStartMonth, type UpcomingItem } from "@/lib/anilist/upcoming"
import { getCurrentSession } from "@/lib/auth"
import {
  VIEW_LABELS,
  buildUpcomingHref,
  clearUpcomingFilters,
  collectGenres,
  filterUpcoming,
  hasUpcomingFilters,
  paginateUpcoming,
  parseUpcomingParams,
  type UpcomingView,
} from "@/lib/upcoming-url"

export const revalidate = 600

const SITE_URL = "https://otakunaija.name.ng"
const BASE = "/episodes/upcoming"

export const metadata: Metadata = {
  title: "Upcoming anime — release dates and schedule",
  description:
    "Every upcoming anime in one place: this week's airing schedule with exact times, next season's premieres, films and TBA titles, all with release dates and trailers.",
  alternates: { canonical: BASE },
  openGraph: {
    type: "website",
    title: "Upcoming anime — release dates and schedule",
    description:
      "This week's airing schedule, next season's premieres and upcoming anime films, refreshed from AniList.",
    url: `${SITE_URL}${BASE}`,
  },
}

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function UpcomingAnimePage({ searchParams }: PageProps) {
  const raw = await searchParams
  const params = parseUpcomingParams(raw)
  const now = new Date()
  const nowMs = now.getTime()

  const [session, cacheState, week, season, later, movies] = await Promise.all([
    getCurrentSession(),
    getUpcomingCacheState(now),
    params.view === "week" ? getAiringThisWeek(now) : Promise.resolve(null),
    params.view === "season" ? getUpcomingBySeason(now) : Promise.resolve(null),
    params.view === "later" ? getUpcomingFurtherOut(now) : Promise.resolve(null),
    params.view === "movies" ? getUpcomingMovies() : Promise.resolve(null),
  ])

  // Logged-in admins can queue a title that is not on the site yet.
  const isAdmin = Boolean(session)

  const allItems: UpcomingItem[] =
    week?.days.flatMap((day) => day.items) ??
    later?.groups.flatMap((group) => group.items) ??
    season?.items ??
    movies?.items ??
    []

  const isGrid = params.view !== "week"
  const genres = collectGenres(allItems)
  const filtered = isGrid ? filterUpcoming(allItems, params) : allItems
  const paged = isGrid ? paginateUpcoming(filtered, params.page) : { items: allItems, page: 1, total: allItems.length, totalPages: 1 }
  const monthGroups = params.view === "later" ? groupByStartMonth(paged.items) : []

  const tabHrefs = {
    week: buildUpcomingHref(params, { view: "week" }),
    season: buildUpcomingHref(params, { view: "season" }),
    later: buildUpcomingHref(params, { view: "later" }),
    movies: buildUpcomingHref(params, { view: "movies" }),
  } satisfies Record<UpcomingView, string>

  // The reader keeps an 8-day window so the cron never clips the tail of a
  // week; the page itself shows the seven day columns of the current week.
  const weekDays = (week?.days ?? []).slice(0, 7)

  const lastUpdatedLabel = formatRelativeAge(cacheState.lastUpdated, now)
  const countLabel = buildCountLabel({
    view: params.view,
    total: isGrid ? paged.total : allItems.length,
    shown: isGrid ? paged.items.length : allItems.length,
    days: weekDays.length,
  })

  const jsonLdItems = (isGrid ? paged.items : allItems).slice(0, 20).map((item, index) => ({
    "@type": "ListItem",
    position: index + 1,
    item: {
      "@type": item.format === "MOVIE" ? "Movie" : "TVSeries",
      name: item.title,
      image: item.coverUrl ?? undefined,
      ...(item.startDateIso ? { startDate: item.startDateIso } : {}),
      url: item.onSite ? `${SITE_URL}${item.href}` : item.externalUrl ?? item.href,
    },
  }))

  const hasAnything = allItems.length > 0
  const emptyCache = !hasAnything && !cacheState.lastUpdated

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@graph": [
              {
                "@type": "BreadcrumbList",
                itemListElement: [
                  { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
                  { "@type": "ListItem", position: 2, name: "Episodes", item: `${SITE_URL}/episodes` },
                  { "@type": "ListItem", position: 3, name: "Upcoming", item: `${SITE_URL}${BASE}` },
                ],
              },
              {
                "@type": "CollectionPage",
                name: "Upcoming anime — release dates and schedule",
                description:
                  "Air times for this week, next season's premieres and upcoming anime films.",
                url: `${SITE_URL}${BASE}`,
              },
              ...(jsonLdItems.length ? [{ "@type": "ItemList", itemListElement: jsonLdItems }] : []),
            ],
          }),
        }}
      />

      <SiteHeader />

      <main className="otk-page mx-auto w-full max-w-7xl flex-1 px-4 py-8 md:px-6 md:py-12">
        <nav aria-label="Breadcrumb" className="otk-meta mb-4">
          <Link href="/" className="otk-focus hover:text-[var(--otk-accent)]">
            Home
          </Link>
          <span aria-hidden="true">/</span>
          <Link href="/episodes" className="otk-focus hover:text-[var(--otk-accent)]">
            Episodes
          </Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">Upcoming</span>
        </nav>

        <CatalogHeader
          eyebrow="Coming soon"
          title="Upcoming anime"
          description="Every anime heading our way — this week's air times, next season's premieres and films still to come, with release dates and trailers."
          count={countLabel}
        />

        <div className="otk-meta mb-5 flex-wrap gap-x-2 gap-y-1" data-testid="upcoming-updated">
          {lastUpdatedLabel ? (
            <span className={cacheState.stale ? "font-semibold text-amber-400" : undefined}>
              Last updated {lastUpdatedLabel}
              {cacheState.stale ? " · this cache is stale, so some dates may be out of date" : ""}
            </span>
          ) : (
            <span>Waiting for the first AniList refresh.</span>
          )}
          {isGrid && paged.total > 0 ? (
            <>
              <span aria-hidden="true">·</span>
              <span>
                Showing {(paged.page - 1) * 24 + 1}–{(paged.page - 1) * 24 + paged.items.length} of {paged.total}
              </span>
            </>
          ) : null}
        </div>

        <UpcomingTabs view={params.view} hrefs={tabHrefs} />

        <div
          id={`upcoming-panel-${params.view}`}
          role="tabpanel"
          aria-labelledby={`upcoming-tab-${params.view}`}
          className="mt-6"
        >
          {isGrid ? (
            <UpcomingToolbar params={params} genres={genres} />
          ) : null}

          {emptyCache ? (
            <div className="otk-empty mt-6">
              <p className="text-lg font-bold text-[var(--otk-text)]">Upcoming titles are still being collected</p>
              <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
                Our AniList cache has not been filled yet. The schedule appears here after the next refresh.
                In the meantime, browse what is already streaming.
              </p>
              <Link href="/episodes" className="otk-pill otk-focus mt-2">
                Browse episodes
              </Link>
            </div>
          ) : !hasAnything ? (
            <div className="otk-empty mt-6">
              <p className="text-lg font-bold text-[var(--otk-text)]">Nothing to show in this view yet</p>
              <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
                AniList has no titles for this window right now. Try another tab or check back after the
                next refresh.
              </p>
              <Link href={tabHrefs.season} className="otk-pill otk-focus mt-2">
                See next season
              </Link>
            </div>
          ) : params.view === "week" && week ? (
            <div className="mt-6">
              <UpcomingWeek days={weekDays} timeZoneLabel={week.timeZone === "Africa/Lagos" ? "WAT" : week.timeZone} />
            </div>
          ) : paged.items.length === 0 ? (
            <div className="otk-empty mt-6">
              <p className="text-lg font-bold text-[var(--otk-text)]">No titles match these filters</p>
              <p className="max-w-md text-sm text-[var(--otk-text-dim)]">
                Try removing the format, genre or “On OtakuNaija only” filter.
              </p>
              {hasUpcomingFilters(params) ? (
                <Link href={clearUpcomingFilters(params)} className="otk-pill otk-focus mt-2">
                  Clear all filters
                </Link>
              ) : null}
            </div>
          ) : params.view === "later" ? (
            <div className="mt-6 space-y-10">
              {monthGroups.map((group) => (
                <section key={group.key} aria-labelledby={`upcoming-month-${group.key}`}>
                  <h2
                    id={`upcoming-month-${group.key}`}
                    className="otk-section-title mb-3 text-lg sm:text-xl"
                  >
                    {group.label}
                  </h2>
                  <UpcomingGrid items={group.items} now={nowMs} isAdmin={isAdmin} />
                </section>
              ))}
            </div>
          ) : (
            <div className="mt-6">
              <UpcomingGrid items={paged.items} now={nowMs} isAdmin={isAdmin} />
            </div>
          )}

          {isGrid && paged.items.length > 0 ? (
            <CatalogPagination
              page={paged.page}
              totalPages={paged.totalPages}
              makeHref={(page) => buildUpcomingHref(params, { page })}
            />
          ) : null}
        </div>

        <p className="otk-meta mt-10 border-t border-[var(--otk-border)] pt-4">
          Release data from{" "}
          <a
            href="https://anilist.co"
            target="_blank"
            rel="noopener noreferrer"
            className="otk-focus font-semibold text-[var(--otk-accent)] hover:underline"
          >
            AniList
          </a>
          . Dates can shift; always check the series page before planning a watch party.
        </p>
      </main>

      <SiteFooter />
    </div>
  )
}

function buildCountLabel({
  view,
  total,
  shown,
  days,
}: {
  view: UpcomingView
  total: number
  shown: number
  days: number
}): string {
  if (view === "week") {
    if (total === 0) return "No episodes scheduled in the next 8 days"
    return `${total} episode${total === 1 ? "" : "s"} across ${days} day${days === 1 ? "" : "s"}`
  }
  if (view === "movies") {
    return `${total} upcoming film${total === 1 ? "" : "s"}${shown !== total ? ` · ${shown} on this page` : ""}`
  }
  return `${total} upcoming title${total === 1 ? "" : "s"}${shown !== total ? ` · ${shown} on this page` : ""}`
}
