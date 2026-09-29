import Link from 'next/link'
import { Pagination, PaginationContent, PaginationItem, PaginationPrevious, PaginationNext, PaginationLink } from '@/components/ui/pagination'

export function CatalogPagination({ page, totalPages, makeHref }: { page: number; totalPages: number; makeHref: (page: number) => string }) {
  if (totalPages <= 1) return null
  return (
    <Pagination className="mt-10">
      <PaginationContent>
        {page > 1 && <PaginationItem><PaginationPrevious href={makeHref(page - 1)} /></PaginationItem>}
        {Array.from({ length: totalPages }, (_, index) => index + 1).filter((number) => number === 1 || number === totalPages || Math.abs(number - page) <= 1).map((number) => (
          <PaginationItem key={number}><PaginationLink href={makeHref(number)} isActive={number === page}>{number}</PaginationLink></PaginationItem>
        ))}
        {page < totalPages && <PaginationItem><PaginationNext href={makeHref(page + 1)} /></PaginationItem>}
      </PaginationContent>
    </Pagination>
  )
}
