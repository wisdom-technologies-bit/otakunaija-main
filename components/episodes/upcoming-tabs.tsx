"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useRef } from "react"
import { nextTabIndex } from "@/lib/tabs-keyboard"
import { VIEW_LABELS, type UpcomingView } from "@/lib/upcoming-url"

const VIEWS: UpcomingView[] = ["week", "season", "later", "movies"]

/**
 * Sticky tab bar. Every tab is a real link (so the view is shareable and
 * works without JS) and the tablist follows the ARIA roving-tabindex pattern:
 * arrows / Home / End move focus and activate, Tab leaves the strip.
 */
export function UpcomingTabs({ view, hrefs }: { view: UpcomingView; hrefs: Record<UpcomingView, string> }) {
  const router = useRouter()
  const refs = useRef<Array<HTMLAnchorElement | null>>([])

  const onKeyDown = (event: React.KeyboardEvent<HTMLAnchorElement>, index: number) => {
    const target = nextTabIndex(index, VIEWS.length, event.key)
    if (target === null) return
    event.preventDefault()
    const nextView = VIEWS[target]
    refs.current[target]?.focus()
    router.push(hrefs[nextView], { scroll: false })
  }

  return (
    <div className="otk-sticky-filters -mx-4 px-4 md:mx-0 md:px-0">
      <div className="otk-tablist" role="tablist" aria-label="Upcoming anime views">
        {VIEWS.map((item, index) => {
          const active = item === view
          return (
            <Link
              key={item}
              ref={(node) => {
                refs.current[index] = node
              }}
              href={hrefs[item]}
              role="tab"
              id={`upcoming-tab-${item}`}
              aria-selected={active}
              tabIndex={active ? 0 : -1}
              data-view={item}
              onKeyDown={(event) => onKeyDown(event, index)}
              className="otk-tab otk-focus"
              prefetch={false}
            >
              {VIEW_LABELS[item]}
            </Link>
          )
        })}
      </div>
    </div>
  )
}

export default UpcomingTabs
