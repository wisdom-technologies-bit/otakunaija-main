# Episodes / Movies / Browse UI Update

## Recommendation

Yes. The current UI is functional, but the three experiences feel like separate catalog screens rather than one clear discovery system. The biggest improvement would be to create a shared **OtakuNaija Catalog** pattern: a strong page header, clear content-type navigation, persistent filters, useful metadata on cards, and consistent pagination.

The visual direction should stay dark and editorial with the existing red accent, but use more hierarchy and less reliance on small pills and hover-only actions.

## Current issues observed

- `/episodes` mixes a hero, horizontal rows, ads, recommendations, genre rows, and a sidebar. It is rich, but the page lacks a clear "what should I watch next?" starting point.
- `/episodes/browse` has status controls, genre controls, sort controls, and pagination, but the controls are visually split across multiple rows and the active filter state is easy to miss.
- The series browse cards prioritize posters, but episode count and status are only visible inside the image overlay. Important metadata should remain readable without hover.
- `/episodes/movies/browse` is visually simpler than the series browse page and does not expose the same level of context or filtering.
- Movie filters do not appear to preserve the current page when switching type, and the active content type is not strongly distinguished.
- Empty, loading, and result-count states need more deliberate treatment.
- Several interactive details are hover-first, which is less effective on touch devices and less discoverable for keyboard users.

## Proposed information architecture

### Shared catalog header

Use the same header structure on Episodes, series browse, and movie browse:

1. Breadcrumb or compact context label: `Episodes` / `Movies & Specials`.
2. Large title and one-line description.
3. Primary content switcher:
   - Discover
   - All series
   - Movies & specials
   - New releases
4. Result count and the active filter summary.

On mobile, the content switcher should become a horizontally scrollable tab row rather than wrapping into multiple lines.

### Episodes landing page

Keep the hero carousel, but make the first viewport more task-oriented:

- Add a concise section heading such as "Continue watching" when progress exists.
- Give "Latest episodes" a prominent position directly after resume watching.
- Group lower-priority rows under a clearer rhythm: latest, movies, recommended, genres, upcoming.
- Limit the number of simultaneous horizontal shelves on mobile; use a "See all" link on every shelf.
- Keep the sidebar below the main content on small screens instead of making it compete with the primary catalog.

### Series browse page

Use a compact filter toolbar inside a bordered or subtly elevated panel:

- Search field: `Search series`.
- Status segmented control: All / Ongoing / Completed / Upcoming.
- Genre select or scrollable genre chips.
- Sort select: Recently added / A–Z.
- Clear filters action when any filter is active.

Show active filters as removable chips below the toolbar. Keep the result count adjacent to the sort control, for example: `42 series`.

### Movies browse page

Bring movies into the same catalog system rather than treating them as a separate grid:

- Use tabs or segmented controls for All / Movies / OVAs / Specials.
- Add a search field and optional year or genre filter when the data supports it.
- Display content type, release year, duration, and a short metadata line below each poster.
- Add a featured or "Recently added" strip above the full grid only if there are enough items; otherwise avoid adding another competing section.

## Card improvements

### Series cards

- Keep the 2:3 poster ratio and use consistent card heights.
- Always show title, status, and episode count below or at the bottom of the card; do not require hover.
- Use a small, consistent metadata line: `12 episodes · Ongoing`.
- Reserve the image overlay for the primary action, such as `View series`.
- Add a subtle favorite/watchlist action only if it can be persisted properly; do not add a decorative button.

### Episode cards

- Keep the 16:9 thumbnail, but make the play affordance visible on focus and touch as well as hover.
- Add series title above or alongside episode title when cards appear outside a series detail page.
- Keep episode number, date, and duration in one predictable metadata row.
- Make the whole card the link and avoid nested controls unless download behavior is implemented.
- Use a consistent thumbnail fallback instead of the current "No image" treatment alone.

### Movie cards

- Keep the poster layout, but increase the title size slightly on desktop and improve line-height.
- Use a bottom gradient for metadata readability over posters.
- Show type and release information consistently, not only the type badge.
- Add visible focus rings and a pressed/tap state for touch users.

## Responsive behavior

- Mobile: two-column poster grid with comfortable 12–16px gaps; keep titles at least 13px and avoid overly small badges.
- Tablet: three or four columns depending on width, with the filter toolbar wrapping into two purposeful rows.
- Desktop: five columns for series and six for movie posters only when card titles remain readable.
- Use horizontal shelves for recommendations and discovery; use paginated grids for intentional browsing.
- Add a sticky filter trigger or compact toolbar on long mobile browse pages.

## Interaction and accessibility

- Use `Link` for navigation controls consistently instead of mixing raw anchors and `Link` components.
- Give the active tab/filter `aria-current="page"` or an equivalent selected state.
- Ensure every image has meaningful alt text; use decorative alt text only when the adjacent title already provides the same information.
- Make focus states as visible as hover states.
- Do not rely on color alone to communicate status; pair badges with text.
- Add a polite result announcement when filters change if the browse interface becomes client-interactive.
- Keep touch targets at least 44px for filter buttons and icon actions.

## Empty, loading, and error states

- Empty results: explain the active filters and provide a `Clear filters` action.
- Loading: use poster-shaped skeletons that match the final grid dimensions to prevent layout shift.
- Error: show a concise recovery message and preserve the selected filters where possible.
- Pagination: retain all active query parameters when moving between pages and show the current page clearly.

## Performance and SEO

- Use responsive `sizes` values appropriate to each grid breakpoint.
- Avoid `unoptimized` images where the configured image host supports Next Image optimization.
- Lazy-load below-the-fold shelves and keep the first hero image prioritized.
- Preserve canonical URLs for filtered pages where appropriate; avoid generating indexable duplicates for every sort/filter combination unless intentional.
- Add structured data for collection pages only when it accurately reflects visible content.

## Suggested implementation order

### Phase 1 — Consistency and clarity

- Create a shared catalog header and content-type navigation.
- Unify status/content-type controls and active states.
- Improve result counts, sorting, pagination, and empty states.
- Make card metadata visible without hover.

### Phase 2 — Discovery improvements

- Add series/movie search to browse pages.
- Add a compact featured or recently added section to movies when useful.
- Reorder the Episodes landing page around resume watching and latest releases.
- Improve mobile shelf behavior and "See all" links.

### Phase 3 — Polish and optimization

- Replace remaining placeholder image states with branded fallbacks.
- Audit keyboard focus, screen-reader labels, and touch target sizes.
- Tune image sizes, loading priority, and layout shift.
- Add analytics events for filter usage, card opens, and pagination to validate the redesign.

## Success criteria

- A visitor can move between episodes, series, and movies without relying on the browser back button.
- Active filters and sort order are obvious at a glance.
- Every card communicates enough context before hover.
- Browse pages remain usable at mobile widths without cramped controls.
- Empty and loading states feel intentional rather than unfinished.
- The first viewport answers either "what should I watch?" or "how do I find something specific?"

## Recommended first slice

Start with the shared catalog header, unified filter toolbar, visible card metadata, and improved empty/loading states. These changes provide the largest usability improvement without requiring new backend behavior or a full visual rewrite.

After that, add search and watchlist only if the product is ready to support their persistence and analytics requirements.
