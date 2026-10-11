import { getAllCreators, getAllSeriesForAdmin } from "@/lib/db/queries"
import { VideoEditor } from "@/components/admin/video-editor"
export default async function NewVideoPage() { const [creators, seriesRows] = await Promise.all([getAllCreators(), getAllSeriesForAdmin()]); return <VideoEditor creators={creators} series={seriesRows.map((r: any) => r.series || r)} /> }
