import type { OfferCategory } from "@prisma/client";

/**
 * What the work actually is.
 *
 * The site could describe the payout mechanism in detail and still leave a
 * visitor unable to answer "so what would I be doing" — which is the first
 * question anyone asks, and the one that decides whether they sign up.
 *
 * Two rules held here:
 *
 * 1. No figures. Not a reward, not a duration, not a completion rate. Every
 *    number on this product comes from a query over real rows (§8), and an
 *    illustrative "$12 per game" on a marketing page would be a number nobody
 *    could check on a product whose whole argument is that you can check the
 *    numbers. What a task pays is on the task, after inventory exists.
 * 2. The unpleasant part of each kind is in the description, not omitted. A
 *    survey can screen you out after ten minutes and pay nothing; a shopping
 *    offer needs your own money first. Someone who finds that out from us
 *    before starting is annoyed at the offer. Someone who finds out afterwards
 *    is angry at us, and is right to be.
 *
 * Keyed by the schema enum, so a category added to the database without a
 * description here fails task-kinds.test.ts rather than rendering as a blank
 * card.
 */
export type TaskKind = {
  /** Plain-language name. The enum value is a database detail. */
  title: string;
  /** What the person does. */
  body: string;
  /** The condition that releases payment — the thing people get wrong. */
  paidWhen: string;
  /** The catch, where there is one worth saying out loud before someone starts. */
  caveat?: string;
};

export const TASK_KINDS: Record<OfferCategory, TaskKind> = {
  GAME: {
    title: "Play a game to a point",
    body: "Install a mobile game and reach something the studio names — a level, a building, a rank. These are usually tiered: the same game pays a little for an early level and much more for a deep one.",
    paidWhen: "the studio's tracker reports you reached that point.",
    caveat:
      "The deeper tiers take real time, and most people stop before them. The share of players who actually got there is shown on every tier, so you can judge the deep ones before you start rather than after a week.",
  },
  APP: {
    title: "Install and use an app",
    body: "Install an app and use it properly — open it on several separate days, or complete a first real action inside it.",
    paidWhen: "the app reports the usage the advertiser asked for.",
    caveat: "Deleting the app before the window ends usually cancels the reward.",
  },
  SURVEY: {
    title: "Answer a survey",
    body: "A market research panel asks about your habits, a product, or a category, and pays for a complete, consistent set of answers.",
    paidWhen: "the panel accepts your response.",
    caveat:
      "You can be screened out partway through, after answering for some minutes, and a screen-out pays nothing. That is the panel's decision and we cannot overturn it — it is the reason surveys are worth treating as the filler, not the plan.",
  },
  SIGNUP: {
    title: "Sign up for a service",
    body: "Create an account with a service and verify it — sometimes a free trial, sometimes just a confirmed email address.",
    paidWhen: "the service confirms the account is real and yours.",
    caveat:
      "If it is a trial, cancelling is on you. Check the advertiser's terms before you start; we have no control over their billing.",
  },
  SHOPPING: {
    title: "Buy something",
    body: "Order from the advertiser. These pay the most by a wide margin, because the advertiser is buying a customer rather than a click.",
    paidWhen: "the order is confirmed and the return window has passed.",
    caveat:
      "Your own money goes first, and the amount is labelled before you open the offer. The purchase is between you and that advertiser — we cannot refund it, cancel it, or chase the delivery.",
  },
  MICROTASK: {
    title: "Do a short job",
    body: "Small, repeatable work: categorise an image, check a price on a shelf, transcribe a receipt, confirm a business is still open.",
    paidWhen: "the buyer accepts the submission.",
    caveat: "Work rejected as inaccurate is not paid, so the instructions are worth reading twice.",
  },
};

/** Render order. Highest-paying and most substantial first; surveys are filler. */
export const TASK_KIND_ORDER: OfferCategory[] = [
  "GAME",
  "SHOPPING",
  "APP",
  "SIGNUP",
  "MICROTASK",
  "SURVEY",
];
