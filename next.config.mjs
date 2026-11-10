/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
    // Remote covers we may use directly when the Cloudinary copy fails.
    // Keep in sync with ALLOWED_COVER_HOSTS in lib/news/image-hosts.ts.
    remotePatterns: [
      { protocol: "https", hostname: "www.animenewsnetwork.com" },
      { protocol: "https", hostname: "cdn.animenewsnetwork.com" },
      // AniList artwork for the upcoming anime cache (s4.anilist.co serves
      // every coverImage/bannerImage URL returned by graphql.anilist.co).
      { protocol: "https", hostname: "s4.anilist.co" },
      // TMDB title logos (app/api/cron/series-logos). `images.unoptimized` is on,
      // so this is documentation plus a guarantee if that ever changes.
      { protocol: "https", hostname: "image.tmdb.org" },
    ],
  },
}

export default nextConfig
