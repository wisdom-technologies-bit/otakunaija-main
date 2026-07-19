import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
import Script from "next/script"
import { Analytics } from "@vercel/analytics/next"
import { Toaster } from "@/components/ui/sonner"
import { ThemeProvider } from "@/components/theme-provider"
import { HideV0Badge } from "@/components/HideV0Badge"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
})

const SITE_URL = "https://otakunaija.name.ng"
const ADSENSE_CLIENT = process.env.NEXT_PUBLIC_ADSENSE_CLIENT

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "OtakuNaija — Anime News, Reviews & Guides for Naija Otakus",
    template: "%s | OtakuNaija",
  },
  description:
    "OtakuNaija is Nigeria's home for anime fans. Get the latest anime news, in-depth reviews, episode breakdowns, and recommendations across Shonen, Romance, Action, and more.",
  keywords: [
    "anime",
    "anime Nigeria",
    "OtakuNaija",
    "anime news",
    "anime reviews",
    "shonen",
    "romance anime",
    "manga",
    "Naija otaku",
  ],
  authors: [{ name: "OtakuNaija Team" }],
  creator: "OtakuNaija",
  publisher: "OtakuNaija",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "en_NG",
    url: SITE_URL,
    siteName: "OtakuNaija",
    title: "OtakuNaija — Anime News, Reviews & Guides",
    description:
      "Nigeria's premier anime community. News, reviews, and recommendations for every otaku.",
    images: [
      {
        url: "/og-image.jpg",
        width: 1200,
        height: 630,
        alt: "OtakuNaija — Anime News for Naija Otakus",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OtakuNaija — Anime News, Reviews & Guides",
    description:
      "Nigeria's premier anime community. News, reviews, and recommendations for every otaku.",
    images: ["/og-image.jpg"],
    creator: "@otakunaija",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  verification: {
    google: process.env.NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION,
  },
  generator: "v0.app",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
}

export const viewport: Viewport = {
  themeColor: "#1a0d1a",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable} bg-background`}>
       <head>
  <meta name="monetag" content="3ebb044040c6a2400146260166c743ea" />
  <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
  <script
    dangerouslySetInnerHTML={{
      __html: `(function(s){s.dataset.zone='261489'; s.src='https://quge5.com/88/tag.min.js'; s.async=true; s.dataset.cfasync='false'; [document.documentElement, document.body].filter(Boolean).pop().appendChild(s)})(document.createElement('script'))`
    }}
  />
</head>
      <body className="font-sans antialiased min-h-dvh bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <HideV0Badge />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
        <Script src="https://scripts.simpleanalyticscdn.com/latest.js" />
      </body>
    </html>
  )
}
