import { NextRequest, NextResponse } from "next/server"
import ogs from "open-graph-scraper"

export async function GET(request: NextRequest) {
  try {
    const url = request.nextUrl.searchParams.get("url")

    if (!url) {
      return NextResponse.json(
        { error: "URL is required" },
        { status: 400 }
      )
    }

    let parsedUrl: URL

    try {
      parsedUrl = new URL(url)
    } catch {
      return NextResponse.json(
        { error: "Invalid URL" },
        { status: 400 }
      )
    }

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return NextResponse.json(
        { error: "Only HTTP and HTTPS URLs are allowed" },
        { status: 400 }
      )
    }

    const { result } = await ogs({
      url,
      timeout: 10000,
      fetchOptions: {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; OtakuNaija-LinkPreview/1.0)",
        },
      },
    })

    const image =
      Array.isArray(result.ogImage) && result.ogImage.length > 0
        ? result.ogImage[0]?.url
        : null

    return NextResponse.json({
      title: result.ogTitle || result.twitterTitle || result.dcTitle || null,
      description:
        result.ogDescription ||
        result.twitterDescription ||
        result.dcDescription ||
        null,
      image,
      url: result.ogUrl || url,
      siteName: result.ogSiteName || parsedUrl.hostname,
    })
  } catch (error) {
    console.error("OG scraper error:", error)

    return NextResponse.json(
      { error: "Unable to fetch link preview" },
      { status: 500 }
    )
  }
}