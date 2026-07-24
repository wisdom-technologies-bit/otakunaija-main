'use client'

import { useState } from 'react'
import { CategoryFilterPills } from '@/components/category-filter-pills'
import { InfinitePostList } from '@/components/infinite-post-list'
import type { Post } from '@/lib/posts'

interface HomepageLatestSectionProps {
  categories: readonly string[]
  initialPosts: Post[]
  initialOffset: number
}

export function HomepageLatestSection({
  categories,
  initialPosts,
  initialOffset,
}: HomepageLatestSectionProps) {
  const [category, setCategory] = useState<string | null>(null)

  return (
    <div>
      <div className="mb-6">
        <CategoryFilterPills categories={categories} onFilterChange={setCategory} />
      </div>
      <InfinitePostList
        key={category ?? 'all'}
        initialPosts={category ? [] : initialPosts}
        initialOffset={category ? 0 : initialOffset}
        category={category}
      />
    </div>
  )
}