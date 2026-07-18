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
    <div className="flex items-center gap-3 rounded-lg border border-border/40 bg-card/30 px-3 py-2.5">
      {/* Avatar */}
      {creator.avatarUrl && (
        <div className="relative h-10 w-10 flex-shrink-0 overflow-hidden rounded-full bg-muted">
          <Image
            src={creator.avatarUrl}
            alt={creator.name}
            fill
            className="object-cover"
            sizes="40px"
          />
        </div>
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-foreground/60 uppercase tracking-wide leading-none">Created by</p>
        <h4 className="text-sm font-bold text-foreground leading-tight">{creator.name}</h4>

        {creator.facebookUrl && (
          <Link
            href={creator.facebookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-0.5 text-xs font-medium text-primary hover:text-primary/80 transition-colors mt-0.5"
          >
            <Facebook className="h-3 w-3" />
            <span className="hidden sm:inline">Follow</span>
          </Link>
        )}
      </div>
    </div>
  )
}
