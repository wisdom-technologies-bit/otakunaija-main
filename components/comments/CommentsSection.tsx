"use client"
import { CommentsWidget } from "./CommentsWidget"

export function CommentsSection({ postSlug }: { postSlug: string }) {
  return <CommentsWidget postSlug={postSlug} />
}