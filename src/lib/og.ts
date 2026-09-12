import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";

/**
 * The link preview for the arcade.
 *
 * One definition, used by the shelf and by every game page, because a card that
 * is pasted into each of them is a card that says six games on one page and
 * four on another the week a game is added.
 *
 * The image itself is rendered from docs/brand/social/render-og.html by
 * scripts/og.ts — the same source-then-render process as the X avatars and
 * header, for the same reason: the design lives somewhere it can be edited,
 * not inside a binary.
 */
export const ARCADE_CARD = "/og/play.jpg";

/**
 * The card for everything that is not the arcade — the landing page, the proof
 * page, the policies.
 *
 * Before this, pasting requit.xyz anywhere produced a bare text row while
 * pasting requit.xyz/play produced a designed card, which reads as a site
 * assembled out of two different projects. The one a stranger meets first is
 * this one.
 */
export const SITE_CARD = "/og/site.jpg";

/** 2× a 1200×630 card. Declared true rather than rounded, so no scraper guesses. */
const WIDTH = 2400;
const HEIGHT = 1260;

/**
 * Attached in the root layout, so every page has a preview and a page with
 * something better of its own simply overrides it.
 */
export function siteCard(title: string, description: string): Metadata {
  const images = [{ url: SITE_CARD, width: WIDTH, height: HEIGHT, alt: `${BRAND.name}` }];

  return {
    openGraph: { title, description, images, type: "website", siteName: BRAND.name },
    twitter: { card: "summary_large_image", title, description, images },
  };
}

export function arcadeCard(title: string, description: string): Metadata {
  const images = [{ url: ARCADE_CARD, width: WIDTH, height: HEIGHT, alt: `${BRAND.name} games` }];

  return {
    openGraph: { title, description, images, type: "website", siteName: BRAND.name },
    twitter: { card: "summary_large_image", title, description, images },
  };
}
