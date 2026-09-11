import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { DisputeForm } from "@/components/dispute-form";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { MAX_OPEN_DISPUTES, OUTCOME_MEANING, STATUS_MEANING } from "@/lib/disputes";
import { money, relative, stamp } from "@/lib/format";

export const metadata = { title: "Disputes" };
export const dynamic = "force-dynamic";

export default async function DisputesPage() {
  const { id } = await requireUser();

  const disputes = await prisma.dispute.findMany({
    where: { userId: id },
    orderBy: { createdAt: "desc" },
    take: 30,
  });

  const open = disputes.filter((dispute) => dispute.status !== "RESOLVED").length;

  return (
    <main className="shell py-10">
      <AppNav current="/disputes" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Disputes</h1>
      <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.65] text-fg-2">
        If a task you finished was never credited, open a dispute. It gets a status you can watch
        move, and we take it to the network. Sometimes the advertiser refuses — when that happens
        we tell you it was refused rather than letting it go quiet.
      </p>

      <div className="mt-7 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Open a dispute"
            aside={open > 0 ? `${open} of ${MAX_OPEN_DISPUTES} open` : undefined}
          />
          {open >= MAX_OPEN_DISPUTES ? (
            <p className="text-[13.5px] leading-[1.6] text-amber">
              You have {MAX_OPEN_DISPUTES} disputes open. Wait for some to close before opening
              more — it keeps the queue moving for everyone, including you.
            </p>
          ) : (
            <DisputeForm />
          )}
        </Card>

        <Card>
          <CardHeader title="The one thing we cannot fix" />
          <p className="max-w-[54ch] text-[13.5px] leading-[1.65] text-fg-2">
            An offer you started outside our link. The network has no way to attribute that
            install to you, so there is nothing for us to dispute — the evidence does not exist on
            their side either.
          </p>
          <p className="mt-4 max-w-[54ch] text-[12.5px] leading-[1.6] text-fg-4">
            Always start from the task page. It is the only thing that makes a completion
            traceable back to your account.
          </p>
        </Card>
      </div>

      <Card className="mt-3">
        <CardHeader title="Your disputes" aside="most recent 30" />
        {disputes.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">You have not opened any.</p>
        ) : (
          <ul>
            {disputes.map((dispute) => (
              <li key={dispute.id} className="border-b border-bd py-4 last:border-b-0">
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <span className="mn text-[15px] font-semibold">
                    {money(dispute.claimedAmount)}
                  </span>
                  <span className="mn text-[12.5px] text-fg-4">{dispute.network}</span>
                  <span className="mn ml-auto text-[12px] text-fg-4">
                    opened {relative(dispute.createdAt)}
                  </span>
                </div>

                <p className="mt-2 max-w-[70ch] text-[13px] leading-[1.6] text-fg-2">
                  {STATUS_MEANING[dispute.status]}
                </p>
                {dispute.outcome ? (
                  <p className="mt-1 max-w-[70ch] text-[13px] leading-[1.6] text-fg-3">
                    {OUTCOME_MEANING[dispute.outcome]}
                  </p>
                ) : null}

                <ChipRow>
                  <Chip>{dispute.status.replace(/_/g, " ").toLowerCase()}</Chip>
                  {dispute.firstReplyAt ? (
                    <Chip>First reply {relative(dispute.firstReplyAt)}</Chip>
                  ) : null}
                  {dispute.escalatedAt ? (
                    <Chip>Escalated {stamp(dispute.escalatedAt)}</Chip>
                  ) : null}
                  {dispute.resolvedAt ? <Chip>Closed {stamp(dispute.resolvedAt)}</Chip> : null}
                </ChipRow>

                {dispute.statusNote ? (
                  <p className="mt-3 max-w-[70ch] rounded-soft bg-surf px-[13px] py-2.5 text-[12.5px] leading-[1.55] text-fg-3 shadow-[inset_0_0_0_1px_var(--color-bd)]">
                    {dispute.statusNote}
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
