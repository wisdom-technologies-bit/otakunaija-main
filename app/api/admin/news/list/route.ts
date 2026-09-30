import { internalErrorResponse, proxyNewsRequest, requireAdminNewsSession } from "@/lib/news-proxy"

export const runtime = "nodejs"

export async function GET(request: Request) {
  try {
    const unauthorized = await requireAdminNewsSession()
    if (unauthorized) return unauthorized

    const url = new URL(request.url)
    return await proxyNewsRequest("/api/news/list", "GET", url.search)
  } catch {
    return internalErrorResponse()
  }
}
