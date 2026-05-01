import { cn } from "@/lib/utils"

type AdSlotProps = {
  slot: "header" | "in-article" | "sidebar" | "footer"
  label?: string
  className?: string
}

const SIZES: Record<AdSlotProps["slot"], string> = {
  header: "h-24 md:h-28",
  "in-article": "h-32 md:h-40",
  sidebar: "h-64",
  footer: "h-24 md:h-28",
}

/**
 * AdSense-ready placeholder slot.
 * In production, replace the inner placeholder with an <ins className="adsbygoogle" ... /> block
 * that references your data-ad-client and data-ad-slot IDs from Google AdSense.
 *
 * Example:
 *   <ins
 *     className="adsbygoogle"
 *     style={{ display: "block" }}
 *     data-ad-client={process.env.NEXT_PUBLIC_ADSENSE_CLIENT}
 *     data-ad-slot="1234567890"
 *     data-ad-format="auto"
 *     data-full-width-responsive="true"
 *   />
 */
export function AdSlot({ slot, label = "Sponsored", className }: AdSlotProps) {
  return (
    <aside
      aria-label={label}
      data-ad-slot={slot}
      className={cn(
        "flex w-full items-center justify-center rounded-lg border border-dashed border-border bg-card/40 text-xs font-medium uppercase tracking-widest text-muted-foreground",
        SIZES[slot],
        className,
      )}
    >
      <span>{label}</span>
    </aside>
  )
}
