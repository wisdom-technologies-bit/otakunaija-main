import { notFound } from "next/navigation"
import { getAllCreators, getAllSeriesForAdmin, getVideoById } from "@/lib/db/queries"
import { VideoEditor } from "@/components/admin/video-editor"
export default async function EditVideoPage({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; const video = await getVideoById(Number(id)); if (!video) notFound(); const [creators, seriesRows] = await Promise.all([getAllCreators(), getAllSeriesForAdmin()]); return <VideoEditor video={video} creators={creators} series={seriesRows.map((r: any) => r.series || r)} /> }
