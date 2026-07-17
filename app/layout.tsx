import type { Metadata, Viewport } from "next"
import { Inter, Outfit } from "next/font/google"
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

const SITE_URL = "https://otakunaija.com.ng"
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
      { url: "/icon-light-32x32.png", media: "(prefers-color-scheme: light)" },
      { url: "/icon-dark-32x32.png", media: "(prefers-color-scheme: dark)" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-icon.png",
  },
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
        {ADSENSE_CLIENT ? (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
            crossOrigin="anonymous"
          />
        ) : null}
        <link rel="sitemap" type="application/xml" href="/sitemap.xml" />
      </head>
      <body className="font-sans antialiased min-h-dvh bg-background text-foreground">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
          <HideV0Badge />
          {children}
          <Toaster richColors position="top-center" />
        </ThemeProvider>
        {process.env.NODE_ENV === "production" && <Analytics />}
      </body>
    </html>
  )
}
