import { NextResponse } from "next/server"
import { getCurrentSession } from "@/lib/auth"
import { getPendingAniListMatches } from "@/lib/anilist-backfill"

export async function GET() {
  if (!(await getCurrentSession())) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  return NextResponse.json(await getPendingAniListMatches())
}
