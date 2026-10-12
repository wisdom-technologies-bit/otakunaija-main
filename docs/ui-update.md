# Episodes, Movies & Browse UI Update

## Recommendation

Yes. The current pages are functional, but the browse experience can feel more like a polished anime catalog by giving users a clearer discovery hierarchy, stronger card metadata, and one consistent filtering system across series, episodes, and movies.

The main opportunity is not adding more decoration; it is making it easier to answer three questions immediately:

1. What should I watch?
2. What have I filtered or sorted?
3. What information will I get before opening a card?

## Current observations

- `/episodes/browse` has separate status pills and genre pills, but the controls read as two unrelated rows.
- The series poster cards are visually clean but expose limited metadata until hover, which is less useful on touch devices.
- `/episodes/movies/browse` uses a compact poster grid, but its title area, filter controls, result count, and pagination are less visually structured than the series catalog.
- Movies, OVAs, and specials use a different card treatment from series, creating two catalog patterns.
- The browse pages do not provide a strong empty state or a visible “clear filters” path when a combination returns no results.
- Hover-only actions and overlays should have equivalent behavior for keyboard and touch users.

## Proposed direction

Use a unified “OtakuNaija catalog” pattern:

- A compact page eyebrow and descriptive heading.
- A filter toolbar with clear active states.
- A result summary and sort control on the same row.
- A consistent responsive card grid.
- Pagination that preserves every active filter.
- A useful empty state with a reset action.

Keep the existing dark theme, red-orange primary color, rounded cards, and display typography. Improve hierarchy and spacing rather than introducing a new visual identity.

## Priority 1: Make the browse header clearer

### Series browse

- Use a two-line header: `Anime catalog` eyebrow, then `Browse all anime` heading.
- Add a short sentence that explains the catalog, followed by the result count.
- Move status and genre controls into a single toolbar card or grouped control area.
- Add a visible `Clear all` action whenever a status, genre, or sort filter is active.

### Movies browse

- Use the same header structure as the series page, with an eyebrow such as `OtakuNaija cinema`.
- Present `All`, `Movies`, `OVAs`, and `Specials` as a proper segmented filter with an obvious selected state.
- Add a result count and current filter label, for example `24 movies` or `8 OVAs`.
- Preserve `contentType` when changing pages and make the active filter visually distinct.

## Priority 2: Unify card design

Create a shared catalog card visual language while keeping the correct aspect ratio for each content type.

### Series cards

- Keep the 2:3 poster format.
- Add a consistent bottom gradient that is always slightly visible, not only on hover.
- Show status, episode count, and genre as compact badges with predictable placement.
- Add a short secondary line below the title, such as `12 episodes · Ongoing`.
- Keep titles at a consistent height so rows align cleanly.

### Movie cards

- Keep the 2:3 poster format.
- Use the same title typography, border radius, hover border, and focus ring as series cards.
- Show content type as a softer badge, with a stronger accent only for the selected or featured item.
- Add runtime or release year when available.
- Add a small play affordance on hover, focus, and tap-friendly card interaction rather than relying on a hidden icon alone.

### Shared states

- Use `focus-visible` rings that are clearly visible against the dark background.
- Keep the entire card clickable, but avoid placing nested interactive buttons inside a link unless the interaction is implemented accessibly.
- Use a consistent fallback image treatment when a poster is missing.
- Respect reduced-motion preferences for poster scale and overlay transitions.

## Priority 3: Improve filtering and sorting

- Replace the current split rows with a responsive toolbar:
  - Status: All, Ongoing, Completed, Upcoming.
  - Genre: horizontally scrollable on small screens, wrapping on larger screens.
  - Sort: Newest, Title.
- On mobile, allow filters to collapse into a `Filters` button and show active filters as removable chips below it.
- Keep URL parameters as the source of truth so links remain shareable and browser back/forward works.
- Reset the page to `1` whenever a filter or sort value changes.
- Preserve all active parameters when selecting another filter or page.
- Consider a desktop-only select for long genre lists rather than showing only the first four genres plus a `More` link that currently returns to the base page.

## Priority 4: Improve responsive layout

Suggested grid behavior:

- Mobile: 2 columns with a minimum readable title size and slightly smaller gaps.
- Small tablet: 3 columns.
- Desktop: 4 or 5 series columns; 5 or 6 movie columns depending on card width.
- Wide screens: cap the content width so posters do not become excessively wide.

On small screens:

- Keep the heading and result summary readable without crowding.
- Make the filter row horizontally scrollable instead of wrapping into a tall block.
- Use larger tap targets for pills and pagination controls.
- Ensure card titles do not become too small to scan.

## Priority 5: Add stronger feedback states

### Empty results

Show a centered state with:

- A simple search/filter icon.
- `No titles match these filters` heading.
- A short explanation.
- `Clear filters` button.

### Loading state

Use skeleton cards that match the final poster aspect ratio, title line count, and grid spacing. This prevents layout shift while catalog data loads.

### Pagination

- Replace text-only `Previous` and `Next` with buttons that include disabled states.
- Add the current page context, such as `Page 2 of 6`.
- Keep the control close to the result grid and repeat it at the top on long catalogs if needed.

## Suggested visual system

- Background: retain the near-black theme.
- Surfaces: use a slightly raised card color for controls and cards instead of relying only on borders.
- Accent: reserve the red-orange primary for selected filters, play actions, and important status emphasis.
- Secondary status colors: use green for ongoing and a muted slate/gray for completed; ensure text contrast remains accessible.
- Radius: use one consistent radius for cards and one smaller radius for badges.
- Typography: use the existing display font for page headings and the existing sans font for metadata and controls.
- Motion: use subtle 150–250ms transitions; avoid scaling posters enough to change their apparent layout.

## Accessibility requirements

- Give every filter group an accessible label, such as `Filter by status` and `Filter by genre`.
- Mark active filters with `aria-current="page"` or an equivalent selected state.
- Never make important information available only on hover.
- Add visible keyboard focus styles to cards, pills, pagination, and sort controls.
- Use descriptive poster alt text, for example the title plus content type where useful.
- Preserve heading order and use a semantic `main` landmark.
- Ensure color is not the only way to communicate status or selection.

## Recommended implementation order

1. Extract shared catalog header, filter toolbar, result summary, and pagination patterns.
2. Standardize series and movie card spacing, typography, badges, focus states, and fallback images.
3. Fix filter URL preservation and reset pagination when filters change.
4. Add empty, loading, and disabled pagination states.
5. Verify the pages at mobile, tablet, and desktop widths, including keyboard navigation.

## Success criteria

- Users can identify the active filters and sort order without guessing.
- Series and movie pages feel like parts of the same product.
- Important metadata is visible on touch devices without hover.
- Filter changes preserve shareable URLs and never unexpectedly lose state.
- Empty and loading states feel intentional rather than broken.
- The catalog remains fast to scan on mobile and desktop.

## Bottom line

The strongest improvement would be a unified catalog toolbar and shared card system, followed by better mobile behavior and explicit empty/loading states. This will make Episodes, Movies, and Browse feel more premium without requiring a major redesign or changing the existing OtakuNaija visual identity.

## Relevant files

- `app/episodes/browse/page.tsx`
- `app/episodes/movies/browse/page.tsx`
- `components/episodes/series-card.tsx`
- `components/episodes/episode-grid-card.tsx`
- `components/episodes/episodes-filter-pills.tsx`
- `components/episodes/catalog-pagination.tsx`
- `app/globals.css`

## Suggested follow-up

Implement the shared toolbar and card states first, then compare both browse pages side by side at 375px, 768px, and 1440px widths before making further visual refinements.

---

*This document is a UI recommendation only; no production UI changes are included yet.*
