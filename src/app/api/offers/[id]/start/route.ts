import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordStart } from "@/lib/offers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Counts a start, then sends the member to the offer.
 *
 * The count has to happen here rather than on the page, because `starts` is the
 * denominator of every completion rate the product publishes. Counting on
 * render would inflate it with everyone who merely scrolled past.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { id } = await context.params;

  const offer = await prisma.offer.findUnique({
    where: { id },
    select: { id: true, isActive: true, network: true, networkOfferId: true },
  });

  if (!offer || !offer.isActive) redirect("/tasks");

  await recordStart(offer.id);

  // Phase 1 has no approved network, so there is no wall to hand off to yet.
  // When there is, the redirect target is built here with the member id as the
  // sub-id — that identifier is what the postback comes back with.
  redirect("/tasks");
}
