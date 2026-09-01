import type { MetadataRoute } from "next"

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/"],
      },
    ],
    sitemap: "https://otakunaija.name.ng/sitemap.xml",
    host: "https://otakunaija.name.ng",
  }
}
