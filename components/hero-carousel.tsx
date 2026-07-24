'use client'

import { useState, useEffect } from 'react'
import { PostCard } from '@/components/post-card'
import type { Post } from '@/lib/posts'

interface HeroCarouselProps {
  posts: Post[]
  intervalMs?: number
}

export function HeroCarousel({ posts, intervalMs = 6000 }: HeroCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  useEffect(() => {
    if (posts.length <= 1) return
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % posts.length)
    }, intervalMs)
    return () => clearInterval(timer)
  }, [posts.length, intervalMs])

  if (posts.length === 0) return null

  return (
    <div>
      <PostCard post={posts[activeIndex]} variant="featured" priority />

      {posts.length > 1 && (
        <div className="mt-4 flex justify-center gap-2">
          {posts.map((_, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              aria-label={`Show featured story ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                i === activeIndex ? 'w-6 bg-primary' : 'w-2 bg-border hover:bg-primary/50'
              }`}
            />
          ))}
        </div>
      )}
    </div>
  )
}