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
    ],
  },
}

export default nextConfig
