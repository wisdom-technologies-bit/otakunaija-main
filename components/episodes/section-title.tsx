import Link from "next/link"
import type { ReactNode } from "react"

export function SectionTitle({ title, href, action, id }: { title: string; href?: string; action?: ReactNode; id?: string }) {
  return (
    <div className="otk-section-head mb-4">
      <h2 id={id} className="otk-section-title flex items-center text-lg sm:text-xl">
        <span aria-hidden="true" className="mr-2 h-5 w-1 rounded-full bg-[var(--otk-accent)]" />
        {title}
      </h2>
      {action ??
        (href ? (
          <Link
            href={href}
            className="otk-focus text-sm font-semibold text-[var(--otk-accent)] hover:underline"
          >
            View all
          </Link>
        ) : null)}
    </div>
  )
}

export default SectionTitle
