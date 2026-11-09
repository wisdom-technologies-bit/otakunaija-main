import Link from "next/link"

type CatalogPaginationProps = {
  page: number
  totalPages: number
  makeHref: (page: number) => string
}

/**
 * Pagination with disabled states, real buttons and the current page context.
 */
export function CatalogPagination({ page, totalPages, makeHref }: CatalogPaginationProps) {
  if (totalPages <= 1) return null

  const numbers = Array.from({ length: totalPages }, (_, index) => index + 1).filter(
    (number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1,
  )

  return (
    <nav aria-label="Pagination" className="mt-10 flex flex-col items-center gap-3">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <PageLink
          href={page > 1 ? makeHref(page - 1) : undefined}
          label="Previous page"
          disabled={page <= 1}
        >
          Previous
        </PageLink>

        {numbers.map((number, index) => {
          const previous = numbers[index - 1]
          const gap = previous !== undefined && number - previous > 1
          return (
            <span key={number} className="flex items-center gap-2">
              {gap ? (
                <span aria-hidden="true" className="text-[var(--otk-text-dim)]">
                  …
                </span>
              ) : null}
              <Link
                href={makeHref(number)}
                aria-current={number === page ? "page" : undefined}
                className="otk-pill otk-focus min-w-11"
                data-active={number === page}
              >
                {number}
              </Link>
            </span>
          )
        })}

        <PageLink
          href={page < totalPages ? makeHref(page + 1) : undefined}
          label="Next page"
          disabled={page >= totalPages}
        >
          Next
        </PageLink>
      </div>
      <p className="otk-meta">
        Page {page} of {totalPages}
      </p>
    </nav>
  )
}

function PageLink({
  href,
  label,
  disabled,
  children,
}: {
  href?: string
  label: string
  disabled: boolean
  children: React.ReactNode
}) {
  if (disabled || !href) {
    return (
      <span
        aria-disabled="true"
        aria-label={label}
        className="inline-flex min-h-11 items-center rounded-full border border-[var(--otk-border)] px-4 text-sm font-medium text-[var(--otk-text-dim)] opacity-50"
      >
        {children}
      </span>
    )
  }
  return (
    <Link
      href={href}
      aria-label={label}
      className="otk-pill otk-focus px-4 text-sm font-semibold text-[var(--otk-text)]"
    >
      {children}
    </Link>
  )
}

export default CatalogPagination
