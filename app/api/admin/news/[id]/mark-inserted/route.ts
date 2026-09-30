import { internalErrorResponse, proxyNewsRequest, requireAdminNewsSession } from "@/lib/news-proxy"

export const runtime = "nodejs"

type RouteContext = { params: Promise<{ id: string }> }

export async function POST(_request: Request, context: RouteContext) {
  try {
    const unauthorized = await requireAdminNewsSession()
    if (unauthorized) return unauthorized

    const { id } = await context.params
    return await proxyNewsRequest(`/api/news/${encodeURIComponent(id)}/mark-inserted`, "POST")
  } catch {
    return internalErrorResponse()
  }
}
