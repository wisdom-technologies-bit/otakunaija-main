'use client'

import dynamic from 'next/dynamic'

export const VideoPlayer = dynamic(
  () => import('@/components/episodes/video-player').then((mod) => mod.VideoPlayer),
  { ssr: false }
)