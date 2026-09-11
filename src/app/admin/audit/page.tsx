import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { Card } from "@/components/ui/card";
import { stamp } from "@/lib/format";

export const metadata = { title: "Audit · Operator" };
export const dynamic = "force-dynamic";

const PAGE = 100;

/**
 * Every manual change, newest first.
 *
 * There is no filter by actor and no delete, deliberately: an audit log an
 * operator can prune is not an audit log. Rows are written inside the same
 * transaction as the change they describe.
 */
export default async function AdminAuditPage() {
  await requireAdmin();

  const entries = await prisma.adminAction.findMany({
    orderBy: { createdAt: "desc" },
    take: PAGE,
  });

  const subjects = await prisma.user.findMany({
    where: { id: { in: entries.map((entry) => entry.subjectId) } },
    select: { id: true, handle: true },
  });
  const handles = new Map(subjects.map((user) => [user.id, user.handle]));

  return (
    <main className="shell py-10">
      <AdminNav current="/admin/audit" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Audit</h1>
      <p className="mt-2 max-w-[66ch] text-[13.5px] leading-[1.65] text-fg-2">
        Every suspension, tier change and withdrawal decision made by a person, with who made it
        and why. Written in the same transaction as the change, and not deletable from here.
      </p>

      <Card className="mt-7">
        {entries.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Nothing has been changed by hand.</p>
        ) : (
          <ul className="text-[13px]">
            {entries.map((entry) => {
              const handle = handles.get(entry.subjectId);
              return (
                <li key={entry.id} className="border-b border-bd py-3 last:border-b-0">
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="mn text-fg">{entry.action}</span>
                    {handle ? (
                      <Link
                        href={`/admin/members/${entry.subjectId}`}
                        className="text-ac-2 hover:underline"
                      >
                        {handle}
                      </Link>
                    ) : (
                      <span className="mn text-[12px] text-fg-4">{entry.subjectId}</span>
                    )}
                    <span className="mn text-[12px] text-fg-4">by {entry.actorEmail}</span>
                    <span className="mn ml-auto text-[12px] text-fg-4">
                      {stamp(entry.createdAt)}
                    </span>
                  </div>
                  <p className="mt-1 max-w-[80ch] text-[12.5px] leading-[1.5] text-fg-3">
                    {entry.reason}
                  </p>
                  {entry.detail ? (
                    <p className="mn mt-1 text-[11.5px] text-fg-4">
                      {JSON.stringify(entry.detail)}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {entries.length === PAGE ? (
        <p className="mt-3 text-[12.5px] text-fg-4">
          Showing the {PAGE} most recent. Older entries are in the database.
        </p>
      ) : null}
    </main>
  );
}
