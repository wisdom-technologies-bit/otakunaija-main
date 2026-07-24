'use client'

import { useState } from 'react'

interface CategoryFilterPillsProps {
  categories: readonly string[]
  onFilterChange: (category: string | null) => void
}

export function CategoryFilterPills({ categories, onFilterChange }: CategoryFilterPillsProps) {
  const [active, setActive] = useState<string | null>(null)

  const handleClick = (category: string | null) => {
    setActive(category)
    onFilterChange(category)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={() => handleClick(null)}
        className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
          active === null
            ? 'bg-primary text-primary-foreground'
            : 'border border-border bg-card text-foreground/80 hover:border-primary hover:text-primary'
        }`}
      >
        All
      </button>
      {categories.map((c) => (
        <button
          key={c}
          onClick={() => handleClick(c)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
            active === c
              ? 'bg-primary text-primary-foreground'
              : 'border border-border bg-card text-foreground/80 hover:border-primary hover:text-primary'
          }`}
        >
          {c}
        </button>
      ))}
    </div>
  )
}