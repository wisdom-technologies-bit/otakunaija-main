'use client'

import { useState, type ReactNode } from 'react'

export interface SeriesTab {
  id: string
  label: string
  content: ReactNode
}

export function SeriesTabs({ tabs }: { tabs: SeriesTab[] }) {
  const [active, setActive] = useState(tabs[0]?.id)

  if (tabs.length <= 1) return <>{tabs[0]?.content}</>

  return (
    <div>
      <div
        role="tablist"
        className="-mx-4 mb-6 flex gap-1 overflow-x-auto border-b border-border px-4 md:mx-0 md:px-0"
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => setActive(t.id)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              active === t.id
                ? 'border-primary text-primary'
                : 'border-transparent text-foreground/70 hover:text-foreground'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t.id} role="tabpanel" className={active === t.id ? '' : 'hidden'}>
          {t.content}
        </div>
      ))}
    </div>
  )
}
