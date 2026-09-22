import type { Metadata } from "next";
import { Schibsted_Grotesk, Newsreader } from "next/font/google";
import "./globals.css";

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
  title: "hoshigo",
  description: "Five five-stars per list.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable}`}>
      <body>{children}</body>
    </html>
  );
}
