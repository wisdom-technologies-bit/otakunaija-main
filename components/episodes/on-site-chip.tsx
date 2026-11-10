import { Check } from "lucide-react"

/**
 * "This title is also on OtakuNaija" badge for AniList cards.
 *
 * On posters narrower than 11rem (phones, the /episodes rail) it collapses to
 * "✓ On site"; from 11rem up it shows the full name. Which one is visible is a
 * container query in app/listings.css, so the accessible name follows the
 * visible text at every width.
 */
export function OnSiteChip() {
  return (
    <span className="otk-chip otk-chip-accent" data-testid="on-site-chip" data-badge="onsite">
      <Check className="h-2.5 w-2.5 shrink-0" aria-hidden="true" />
      <span className="otk-chip-onsite-short">On site</span>
      <span className="otk-chip-onsite-full">On OtakuNaija</span>
    </span>
  )
}

export default OnSiteChip
