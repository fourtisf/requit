import { redirect } from "next/navigation";
import type { Route } from "next";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordStart } from "@/lib/offers";
import { buildHandoff } from "@/lib/networks/handoff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Counts a start, then sends the member to the offer.
 *
 * The count has to happen here rather than on the page, because `starts` is the
 * denominator of every completion rate the product publishes. Counting on
 * render would inflate it with everyone who merely scrolled past.
 *
 * It also has to happen *after* the handoff is known to be possible. A click
 * that cannot carry the member's id is not a start — nobody can complete it —
 * and counting it would push every completion rate on the site towards zero
 * while the offer is unreachable.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/signin");

  const { id } = await context.params;

  const offer = await prisma.offer.findUnique({
    where: { id },
    select: { id: true, isActive: true, network: true, trackingUrl: true },
  });

  if (!offer || !offer.isActive) redirect("/tasks");

  const handoff = buildHandoff({
    network: offer.network,
    trackingUrl: offer.trackingUrl,
    userId: session.user.id,
  });

  // Sending someone out on a link the network cannot attribute is the one
  // failure this product cannot apologise its way out of: they do the work and
  // the conversion arrives attached to nobody.
  if (!handoff.ok) redirect(`/tasks?unavailable=${handoff.reason}`);

  await recordStart(offer.id);
  // Cast: typed routes types redirect() for internal paths, and this one
  // deliberately leaves the site. buildHandoff has already proved it parses as
  // an https URL.
  redirect(handoff.url as Route);
}
