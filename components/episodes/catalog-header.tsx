import type { ReactNode } from "react"

type CatalogHeaderProps = {
  eyebrow: string
  title: string
  description: string
  count: string
  actions?: ReactNode
}

/** Unified catalogue header: eyebrow, one h1, a sentence and the result count. */
export function CatalogHeader({ eyebrow, title, description, count, actions }: CatalogHeaderProps) {
  return (
    <header className="mb-6">
      <p className="otk-eyebrow">{eyebrow}</p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="otk-display text-3xl md:text-5xl">{title}</h1>
        {actions}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[var(--otk-text-dim)]">{description}</p>
      <p className="otk-meta mt-2">{count}</p>
    </header>
  )
}

export default CatalogHeader
