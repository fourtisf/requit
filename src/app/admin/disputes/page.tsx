import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { AdminForm } from "@/components/admin-form";
import { advanceDisputeAction } from "@/app/admin/actions";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip, ChipRow } from "@/components/ui/chip";
import { OUTCOME_MEANING, STATUS_MEANING } from "@/lib/disputes";
import { money, relative, stamp } from "@/lib/format";

export const metadata = { title: "Disputes · Operator" };
export const dynamic = "force-dynamic";

/** Where each status may go next. Forward only — the timestamps are published. */
const NEXT: Record<string, { value: string; label: string }[]> = {
  SUBMITTED: [
    { value: "ACKNOWLEDGED", label: "Acknowledge — a person has read it" },
    { value: "ESCALATED", label: "Escalate to the network" },
    { value: "RESOLVED", label: "Close it" },
  ],
  ACKNOWLEDGED: [
    { value: "ESCALATED", label: "Escalate to the network" },
    { value: "AWAITING_NETWORK", label: "Waiting on the network" },
    { value: "RESOLVED", label: "Close it" },
  ],
  ESCALATED: [
    { value: "AWAITING_NETWORK", label: "Waiting on the network" },
    { value: "RESOLVED", label: "Close it" },
  ],
  AWAITING_NETWORK: [{ value: "RESOLVED", label: "Close it" }],
};

const OUTCOMES = [
  { value: "", label: "— outcome, required to close —" },
  { value: "PAID", label: "Paid — we credited them" },
  { value: "REJECTED_BY_ADVERTISER", label: "Rejected by the advertiser" },
  { value: "EXPIRED", label: "Expired — the network never answered" },
  { value: "WITHDRAWN", label: "Withdrawn by the member" },
];

export default async function AdminDisputesPage() {
  await requireAdmin();

  const [open, recent] = await Promise.all([
    prisma.dispute.findMany({
      where: { status: { not: "RESOLVED" } },
      orderBy: { createdAt: "asc" }, // oldest first: nobody waits twice
      take: 50,
      include: { user: { select: { id: true, handle: true, riskTier: true } } },
    }),
    prisma.dispute.findMany({
      where: { status: "RESOLVED" },
      orderBy: { resolvedAt: "desc" },
      take: 10,
      include: { user: { select: { id: true, handle: true } } },
    }),
  ]);

  return (
    <main className="shell py-10">
      <AdminNav current="/admin/disputes" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Disputes</h1>
      <p className="mt-2 max-w-[68ch] text-[13.5px] leading-[1.65] text-fg-2">
        Oldest first. Every move stamps a timestamp, and those timestamps are what /proof
        publishes as our response times — so the published figures are the real ones whether or
        not they flatter us.
      </p>

      {open.length === 0 ? (
        <Card className="mt-7">
          <p className="text-[13.5px] text-fg-3">Nothing open.</p>
        </Card>
      ) : (
        <div className="mt-7 grid gap-3">
          {open.map((dispute) => (
            <Card key={dispute.id}>
              <CardHeader
                title={
                  <>
                    <span className="mn">{money(dispute.claimedAmount)}</span>{" "}
                    <span className="text-fg-3">claimed by</span>{" "}
                    <Link
                      href={`/admin/members/${dispute.user.id}`}
                      className="text-ac-2 hover:underline"
                    >
                      {dispute.user.handle}
                    </Link>
                  </>
                }
                aside={`${dispute.network} · opened ${relative(dispute.createdAt)}`}
              />

              <p className="max-w-[76ch] whitespace-pre-wrap text-[13px] leading-[1.6] text-fg-2">
                {dispute.statusNote}
              </p>

              <ChipRow>
                <Chip>{STATUS_MEANING[dispute.status]}</Chip>
                {dispute.firstReplyAt ? (
                  <Chip>First reply {stamp(dispute.firstReplyAt)}</Chip>
                ) : (
                  <Chip tone="amber">No reply yet</Chip>
                )}
                {dispute.user.riskTier === "FLAGGED" ? (
                  <Chip tone="amber">Member flagged</Chip>
                ) : null}
              </ChipRow>

              {dispute.evidenceUrls.length > 0 ? (
                <ul className="mt-4 text-[12.5px]">
                  {dispute.evidenceUrls.map((url) => (
                    <li key={url} className="border-b border-bd py-1.5 last:border-b-0">
                      {/* noreferrer as well as noopener: an evidence link is
                          attacker-supplied, and the referrer would tell them an
                          operator opened it from the admin panel. */}
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer nofollow"
                        className="mn break-all text-ac-2 hover:underline"
                      >
                        {url}
                      </a>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-[12.5px] text-fg-4">No evidence attached.</p>
              )}

              <div className="mt-5 border-t border-bd pt-5">
                <AdminForm
                  action={advanceDisputeAction}
                  hidden={{ disputeId: dispute.id }}
                  label="Move it forward — the member is sent this note"
                  verb="Move"
                >
                  <select
                    name="to"
                    defaultValue={NEXT[dispute.status]?.[0]?.value ?? "RESOLVED"}
                    className="mt-2 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
                  >
                    {(NEXT[dispute.status] ?? []).map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <select
                    name="outcome"
                    defaultValue=""
                    className="mt-2 w-full rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
                  >
                    {OUTCOMES.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </AdminForm>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card className="mt-3">
        <CardHeader title="Recently closed" aside="last 10" />
        {recent.length === 0 ? (
          <p className="text-[13px] text-fg-3">None yet.</p>
        ) : (
          <ul className="text-[13px]">
            {recent.map((dispute) => (
              <li
                key={dispute.id}
                className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-bd py-2.5 last:border-b-0"
              >
                <span className="mn">{money(dispute.claimedAmount)}</span>
                <Link
                  href={`/admin/members/${dispute.user.id}`}
                  className="text-ac-2 hover:underline"
                >
                  {dispute.user.handle}
                </Link>
                <span className="text-fg-3">
                  {dispute.outcome ? OUTCOME_MEANING[dispute.outcome] : "—"}
                </span>
                <span className="mn ml-auto text-[12px] text-fg-4">
                  {dispute.resolvedAt ? stamp(dispute.resolvedAt) : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </main>
  );
}
