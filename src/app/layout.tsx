import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  title: {
    default: `${BRAND.name} — Advertiser-funded work. Paid the same day.`,
    template: `%s · ${BRAND.name}`,
  },
  description:
    `Finish a task, the network confirms it, and ${BRAND.name} pays you in USD or ETH.`,
  applicationName: BRAND.name,
  // Shared links had no preview at all before this: no title, no description,
  // no card. Pages that have a picture of their own add one on top — today that
  // is the arcade (src/lib/og.ts). A site-wide card is still to be drawn, and
  // an empty og:image is better than the wrong one.
  openGraph: {
    type: "website",
    siteName: BRAND.name,
    title: `${BRAND.name} — Advertiser-funded work. Paid the same day.`,
    description: `Finish a task, the network confirms it, and ${BRAND.name} pays you in USD or ETH.`,
  },
  twitter: { card: "summary" },
};

export const viewport: Viewport = {
  themeColor: "#08090A",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <div className="glow" aria-hidden />
        <div className="grain" aria-hidden />
        <div className="relative z-[2]">{children}</div>
      </body>
    </html>
  );
}
