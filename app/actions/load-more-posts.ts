'use server'

import { getAllPosts, getRecentPosts } from '@/lib/posts'

export async function loadMorePosts(offset: number, limit: number = 10, category?: string) {
  if (category) {
    // getAllPosts doesn't support offset/limit natively — fetch all matching, then slice
    const allMatching = await getAllPosts({ category })
    return allMatching.slice(offset, offset + limit)
  }
  return getRecentPosts(limit, offset)
}