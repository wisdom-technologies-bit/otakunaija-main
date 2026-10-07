'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

export function SectionTitle({ title, href, action }: { title: string; href?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="flex items-center text-lg font-semibold text-foreground sm:text-xl">
        <span aria-hidden="true" className="mr-2 h-5 w-1 rounded-full bg-primary" />
        {title}
      </h2>
      {action ?? (href ? <Link href={href} className="text-sm font-medium text-primary hover:underline">View All</Link> : null)}
    </div>
  )
}

export default SectionTitle
