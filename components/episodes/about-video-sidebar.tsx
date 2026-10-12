import Image from 'next/image'
import { type Video } from '@/lib/db/schema'
import { AdSlot } from '@/components/ad-slot'

interface AboutVideoSidebarProps {
  video: Video
}

function labelContentType(contentType: string) {
  return contentType.charAt(0).toUpperCase() + contentType.slice(1)
}

export function AboutVideoSidebar({ video }: AboutVideoSidebarProps) {
  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <h2 className="text-lg font-bold text-foreground">About {video.title}</h2>
        <div className="flex gap-4">
          <div className="relative aspect-[2/3] w-28 flex-shrink-0 overflow-hidden rounded-lg border border-border/60 bg-muted sm:w-32">
            <Image src={video.posterImageUrl || video.thumbnailUrl} alt={video.title} fill className="object-cover" sizes="128px" />
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <p className="line-clamp-6 text-sm leading-relaxed text-foreground/80">{video.synopsis || 'No synopsis available'}</p>
          </div>
        </div>
      </div>
      <div className="rounded-lg border border-border/60 bg-card/40 p-4 space-y-3">
        <h3 className="text-sm font-bold text-foreground">Title Details</h3>
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-foreground/70">
          <span>{labelContentType(video.contentType)}</span>
          {video.genre && <><span>·</span><span>{video.genre}</span></>}
          {video.durationSeconds && <><span>·</span><span>{Math.floor(video.durationSeconds / 60)} min</span></>}
        </div>
      </div>
      <AdSlot slot="sidebar" label="sidebar" />
    </div>
  )
}
