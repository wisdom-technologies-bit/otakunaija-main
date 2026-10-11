import { getPendingAniListMatches } from "@/lib/anilist-backfill"
import { AniListBackfillClient } from "@/components/admin/anilist-backfill-client"

export const metadata = { title: "AniList Backfill" }

export default async function AniListBackfillPage() {
  const matches = await getPendingAniListMatches()
return <AniListBackfillClient initialMatches={matches} />
}
