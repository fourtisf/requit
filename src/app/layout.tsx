import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { BRAND } from "@/lib/brand";
import { siteCard } from "@/lib/og";
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
  // Every page gets a link preview from here; a page with a picture of its own
  // overrides it (today that is the arcade, src/lib/og.ts). Before this the
  // site itself had no card at all, which is what a link to it looked like
  // when someone forwarded it.
  ...siteCard(
    `${BRAND.name} — Advertiser-funded work. Paid the same day.`,
    `Finish a task, the network confirms it, and ${BRAND.name} pays you in USD or ETH.`,
  ),
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
