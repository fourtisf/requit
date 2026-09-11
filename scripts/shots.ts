/**
 * Renders the marketing screenshots. Run after scripts/seed-demo.ts, with the
 * dev server up. See public/shots/README.md.
 */
import { chromium, type Browser } from "playwright";
import { resolve } from "node:path";

const BASE = process.env.SHOT_BASE_URL ?? "http://localhost:3000";
const OUT = resolve(process.cwd(), "public/shots");

/** Matches the session scripts/seed-demo.ts creates. */
const SESSION = "demo-shot-session";

type Shot = {
  file: string;
  path: string;
  width: number;
  height: number;
  scale: number;
  mobile: boolean;
};

const SHOTS: Shot[] = [
  { file: "app.png", path: "/tasks", width: 1280, height: 760, scale: 2, mobile: false },
  { file: "app-mobile.png", path: "/tasks", width: 390, height: 720, scale: 3, mobile: true },
];

async function shoot(browser: Browser, shot: Shot): Promise<void> {
  const context = await browser.newContext({
    viewport: { width: shot.width, height: shot.height },
    deviceScaleFactor: shot.scale,
    isMobile: shot.mobile,
    hasTouch: shot.mobile,
  });
  await context.addCookies([
    { name: "authjs.session-token", value: SESSION, domain: "localhost", path: "/" },
  ]);

  const page = await context.newPage();
  await page.goto(`${BASE}${shot.path}`, { waitUntil: "networkidle" });
  // The dev-server badge is a local artefact with no business in a marketing image.
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  await page.waitForTimeout(500);

  // A fixed clip, so the image is a predictable size rather than however tall
  // the page happens to be on the day.
  await page.screenshot({
    path: resolve(OUT, shot.file),
    clip: { x: 0, y: 0, width: shot.width, height: shot.height },
  });
  await context.close();
  console.log(`wrote ${shot.file}`);
}

async function main(): Promise<void> {
  const executablePath = process.env.CHROMIUM_PATH;
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  try {
    for (const shot of SHOTS) await shoot(browser, shot);
  } finally {
    await browser.close();
  }
}

void main();
