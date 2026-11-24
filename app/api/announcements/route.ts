import { NextResponse } from "next/server"
import { getActivePublicAnnouncements } from "@/lib/announcements/queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

/**
 * Public: the (at most two) currently active announcements. The browser matches
 * them against the current page, so one cached request serves every navigation.
 * Never errors: a missing table or database problem just returns an empty list.
 */
export async function GET() {
  const announcements = await getActivePublicAnnouncements()
  return NextResponse.json(
    { announcements },
    { headers: { "Cache-Control": "public, max-age=0, s-maxage=20, stale-while-revalidate=120" } },
  )
}
