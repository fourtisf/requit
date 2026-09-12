/**
 * Renders the link-preview cards from their HTML source.
 *
 * The same process as the X avatars and header (docs/brand/social/README.md):
 * the design lives in an HTML file that can be opened and edited, and this
 * turns it into the file a scraper fetches.
 *
 *   npx tsx scripts/og.ts
 *
 * JPEG rather than PNG on purpose. The grain that stops a flat panel on flat
 * black looking cheap is noise, and noise is the one thing PNG cannot compress:
 * the first render came out at 2.6MB, which WhatsApp declines to fetch at all.
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

const SOURCE = resolve(process.cwd(), "docs/brand/social/render-og.html");
const OUT = resolve(process.cwd(), "public/og");

/** Each card is one element in the source, screenshotted at 2× a 1200×630. */
const CARDS: { id: string; file: string }[] = [{ id: "og-play", file: "play.jpg" }];

async function main(): Promise<void> {
  mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1240, height: 700 },
    deviceScaleFactor: 2,
  });

  await page.goto(`file://${SOURCE}`, { waitUntil: "networkidle" });
  // Geist is loaded from node_modules by the source file; screenshotting before
  // it lands renders the whole card in a fallback face.
  await page.evaluate(() => document.fonts.ready);

  for (const card of CARDS) {
    await page.locator(`#${card.id}`).screenshot({
      path: resolve(OUT, card.file),
      type: "jpeg",
      quality: 88,
    });
    console.log(`wrote public/og/${card.file}`);
  }

  await browser.close();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
