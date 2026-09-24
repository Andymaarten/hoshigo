import type { Metadata } from "next";
import { Schibsted_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";
import FeedbackTab from "@/components/FeedbackTab";
import { Analytics } from "@vercel/analytics/next";

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
        {/* Vercel Web Analytics: cookieless page views, so no consent banner */}
        <Analytics />
      </body>
    </html>
  );
}
