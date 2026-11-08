import { NextResponse } from "next/server"
import { requireAdminNewsSession } from "@/lib/news-proxy"
import { getIngestCounts, listIngestRows, type AdminIngestRow } from "@/lib/news/store"
import { readConfig } from "@/lib/news/ingest"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export type AutomationRow = {
  id: number
  guid: string
  status: string
  original_title: string | null
  source_url: string
  source_name: string | null
  original_published_at: string | null
  image_url: string | null
  topics: string[] | null
  attempts: number
  last_error: string | null
  has_rewrite: boolean
  post_id: number | null
  post_slug: string | null
  created_at: string
  updated_at: string
}

function toAutomationRow(row: AdminIngestRow): AutomationRow {
  return {
    id: row.id,
    guid: row.guid,
    status: row.status,
    original_title: row.original_title,
    source_url: row.source_url,
    source_name: row.source_name,
    original_published_at: row.original_published_at,
    image_url: row.image_url,
    topics: row.topics,
    attempts: row.attempts,
    last_error: row.last_error,
    has_rewrite: Boolean(row.rewritten),
    post_id: row.post_id,
    post_slug: row.post_slug,
    created_at: row.created_at,
    updated_at: row.updated_at,
  }
}

export async function GET() {
  const unauthorized = await requireAdminNewsSession()
  if (unauthorized) return unauthorized

  try {
    const [rows, counts] = await Promise.all([listIngestRows(100), getIngestCounts()])
    const config = readConfig()
    return NextResponse.json({
      rows: rows.map(toAutomationRow),
      counts,
      autopublish: config.autopublish,
      pushEnabled: config.pushEnabled,
      maxPerRun: config.limit,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    const hint = /relation "news_ingest" does not exist/i.test(message)
      ? "Run docs/sql/news-automation.sql in the Neon SQL editor first."
      : undefined
    return NextResponse.json({ error: "INTERNAL_ERROR", message, hint }, { status: 500 })
  }
}
