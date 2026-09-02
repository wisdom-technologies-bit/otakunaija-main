'use server'

import { getAllPosts, getRecentPosts } from '@/lib/posts'

export async function loadMorePosts(offset: number, limit: number = 10, category?: string, search?: string) {
  return getAllPosts({ category, search, limit, offset })
}
