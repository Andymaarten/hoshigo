import type { Metadata, Viewport } from "next";
import { Schibsted_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";
import FeedbackTab from "@/components/FeedbackTab";
import AppChrome from "@/components/AppChrome";
import { Analytics } from "@vercel/analytics/next";

// Portrait launch images for current iPhones: pixel width, height, device pixel ratio.
const SPLASH: [number, number, number][] = [
  [1320, 2868, 3], [1290, 2796, 3], [1206, 2622, 3], [1179, 2556, 3], [1170, 2532, 3],
  [1284, 2778, 3], [1125, 2436, 3], [1242, 2688, 3], [828, 1792, 2], [750, 1334, 2],
];

const display = Schibsted_Grotesk({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

const serif = Newsreader({
  variable: "--font-serif",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://hoshigo.cc"),
  title: "hoshigo",
  description: "A personal place for the handful of things you would give five stars.",
  applicationName: "hoshigo",
  appleWebApp: {
    capable: true,
    title: "hoshigo",
    // dark text on the paper colour, like the page itself
    statusBarStyle: "default",
    startupImage: SPLASH.map(([w, h, dpr]) => ({
      url: `/splash/splash-${w}x${h}.png`,
      media: `(device-width: ${w / dpr}px) and (device-height: ${h / dpr}px) and (-webkit-device-pixel-ratio: ${dpr}) and (orientation: portrait)`,
    })),
  },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#efe7d8",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <head>
        {/* Shippori Mincho's Japanese glyph subset isn't in next/font's bundled index yet,
            so this one loads the ordinary way instead of via next/font/google. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Shippori+Mincho:wght@400;700&display=swap"
        />
      </head>
      <body>
        {children}
        <FeedbackTab />
        <AppChrome />
        {/* Vercel Web Analytics: cookieless page views, so no consent banner */}
        <Analytics />
      </body>
    </html>
  );
}
