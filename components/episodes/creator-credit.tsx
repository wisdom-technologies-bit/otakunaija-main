'use client'

import Link from 'next/link'
import Image from 'next/image'
import { type Creator } from '@/lib/db/schema'
import { Facebook } from 'lucide-react'

interface CreatorCreditProps {
  creator: Creator
}

export function CreatorCredit({ creator }: CreatorCreditProps) {
  return (
    <div className="border-b border-border/40 px-4 md:px-6 py-6">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-start gap-4 rounded-lg border border-border/60 bg-card/40 p-4">
          {/* Avatar */}
          {creator.avatarUrl && (
            <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden rounded-full bg-muted">
              <Image
                src={creator.avatarUrl}
                alt={creator.name}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground/60 uppercase tracking-wide mb-1">Created by</p>
            <h4 className="text-lg font-bold text-foreground mb-1">{creator.name}</h4>

            {creator.bio && (
              <p className="line-clamp-2 text-sm text-foreground/70 mb-2">{creator.bio}</p>
            )}

            {creator.facebookUrl && (
              <Link
                href={creator.facebookUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                <Facebook className="h-3.5 w-3.5" />
                Follow on Facebook
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
