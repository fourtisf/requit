import { prisma } from "@/lib/prisma";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { GAME_SLUGS } from "@/lib/games/catalog";

/**
 * What a member can actually do here today, and what each one buys them.
 *
 * The honest problem this solves: there are no tasks. The machinery for them is
 * built and the inventory is empty, because no offer network has approved us
 * yet — so a member who signs up finds a dashboard with nothing on it and no
 * reason to come back. Games are something to do; they are not something to
 * *finish*.
 *
 * So this is a short, finite list of the things that are real work today, every
 * one of them checked against the database rather than ticked by clicking. Not
 * one of them pays, and the card that shows them says so first. What they buy
 * is a better first day when tasks do arrive: a member with a verified wallet
 * and a known country is paid the same day, and one without either is a support
 * ticket.
 *
 * Deliberately not here: streaks, daily check-ins, badges. Rewarding someone
 * for opening a page is a way of having activity without having a product, and
 * the whole argument of this site is that it does not do that.
 */

export type StepId = "country" | "wallet" | "waiting" | "notify" | "referral" | "played";

export type Step = {
  id: StepId;
  title: string;
  /** What it is for, in the member's terms. Never what it pays, because none pay. */
  why: string;
  done: boolean;
  /** Where it gets done. Null when there is nothing for them to do. */
  href: string | null;
  action: string;
};

export type Readiness = {
  steps: Step[];
  done: number;
  total: number;
};

export async function readinessFor(userId: string): Promise<Readiness> {
  const [user, wallet, waiting, referrals, played] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { countryCode: true, notifyRewards: true, notifyWithdrawals: true },
    }),
    // Verified, not merely typed in: an unverified address is one nobody has
    // proved they hold the key to, and it is not a payout destination.
    prisma.wallet.count({ where: { userId, verifiedAt: { not: null } } }),
    prisma.countryInterest.count({ where: { userId } }),
    prisma.user.count({ where: { referredById: userId } }),
    prisma.gameSession.count({
      where: { userId, game: { in: [...GAME_SLUGS] }, endedAt: { not: null } },
    }),
  ]);

  const countryKnown = (user?.countryCode ?? UNKNOWN_COUNTRY) !== UNKNOWN_COUNTRY;

  const steps: Step[] = [
    {
      id: "country",
      title: "Have a country on file",
      why: "Offers are matched by country. Without one you are eligible for nothing, whatever goes live.",
      done: countryKnown,
      href: countryKnown ? null : "/settings",
      action: countryKnown ? "On file" : "Set it",
    },
    {
      id: "wallet",
      title: "Bind a payout wallet",
      why: "Proving you hold the key takes a minute now and nothing later. It is the difference between being paid the same day and opening a ticket.",
      done: wallet > 0,
      href: wallet > 0 ? null : "/withdraw",
      action: wallet > 0 ? "Verified" : "Bind one",
    },
    {
      id: "waiting",
      title: "Join the list for your country",
      why: "It is the evidence we take to the networks about where the demand is, and it is how you hear the day there is work where you are.",
      done: waiting > 0,
      href: waiting > 0 ? null : "/tasks",
      action: waiting > 0 ? "On the list" : "Join it",
    },
    {
      id: "notify",
      title: "Leave reward emails on",
      why: "A confirmed task and a paid withdrawal both send one. With them off, the first thing you hear about your money is nothing.",
      done: Boolean(user?.notifyRewards && user?.notifyWithdrawals),
      href: "/settings",
      action: user?.notifyRewards && user?.notifyWithdrawals ? "On" : "Turn on",
    },
    {
      id: "referral",
      title: "Bring someone with you",
      why: "Your code is live and the graph is recorded from now on. What a referral pays is not decided yet, and we are not going to invent a number for it.",
      done: referrals > 0,
      href: "/referrals",
      action: referrals > 0 ? `${referrals} joined` : "Get your link",
    },
    {
      id: "played",
      title: "Finish a round of something",
      why: "The one part of this site that works today. It pays nothing either, and the score is checked on our server rather than taken from your browser.",
      done: played > 0,
      href: "/play",
      action: played > 0 ? "Played" : "Play one",
    },
  ];

  return { steps, done: steps.filter((step) => step.done).length, total: steps.length };
}
