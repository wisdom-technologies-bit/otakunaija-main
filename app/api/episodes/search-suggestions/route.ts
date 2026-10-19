import { NextResponse } from 'next/server'
import { getSearchSuggestions } from '@/lib/db/queries'

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get('q')?.trim() ?? ''
  if (query.length < 2) return NextResponse.json({ series: [], episodes: [] })
  if (query.length > 100) return NextResponse.json({ error: 'Query is too long.' }, { status: 400 })

  try {
    const results = await getSearchSuggestions(query)
    return NextResponse.json(results, {
      headers: { 'Cache-Control': 'public, s-maxage=30, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json({ error: 'Suggestions are temporarily unavailable.' }, { status: 503 })
  }
}
