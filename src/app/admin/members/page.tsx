import Link from "next/link";
import { requireAdmin } from "@/lib/admin/access";
import { prisma } from "@/lib/prisma";
import { AdminNav } from "@/components/admin-nav";
import { Card } from "@/components/ui/card";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { TIER_RULES } from "@/lib/risk";
import { stamp } from "@/lib/format";

export const metadata = { title: "Members · Operator" };
export const dynamic = "force-dynamic";

const PAGE = 50;

export default async function AdminMembersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; tier?: string }>;
}) {
  await requireAdmin();
  const { q = "", tier = "" } = await searchParams;
  const query = q.trim();

  const members = await prisma.user.findMany({
    where: {
      ...(query
        ? {
            OR: [
              { handle: { contains: query, mode: "insensitive" as const } },
              { email: { equals: query, mode: "insensitive" as const } },
              { id: query },
              { referralCode: { equals: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(tier in TIER_RULES ? { riskTier: tier as keyof typeof TIER_RULES } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: PAGE,
    select: {
      id: true,
      handle: true,
      email: true,
      countryCode: true,
      riskTier: true,
      suspendedAt: true,
      createdAt: true,
    },
  });

  return (
    <main className="shell py-10">
      <AdminNav current="/admin/members" />

      <h1 className="mn text-[27px] font-semibold tracking-[-0.03em]">Members</h1>

      {/* A GET form: the search lives in the URL, so a result can be pasted to
          someone else and lands on the same rows. */}
      <form method="get" className="mt-6 flex flex-wrap items-center gap-2">
        <input
          name="q"
          defaultValue={query}
          placeholder="Handle, email, id or referral code"
          className="min-w-[240px] flex-1 rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none placeholder:text-fg-4 focus:shadow-[inset_0_0_0_1px_var(--color-bd-2)]"
        />
        <select
          name="tier"
          defaultValue={tier}
          className="rounded-soft bg-surf px-3 py-2 text-[13px] text-fg shadow-[inset_0_0_0_1px_var(--color-bd)] outline-none"
        >
          <option value="">Any tier</option>
          {Object.values(TIER_RULES).map((rule) => (
            <option key={rule.tier} value={rule.tier}>
              {rule.label}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="rounded-soft bg-surf-2 px-4 py-2 text-[13px] font-medium text-fg shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:bg-surf-3"
        >
          Search
        </button>
      </form>

      <Card className="mt-4">
        {members.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No member matches that.</p>
        ) : (
          <TableScroll>
            <thead>
              <tr>
                <Th>Handle</Th>
                <Th>Country</Th>
                <Th>Tier</Th>
                <Th>Joined</Th>
                <Th>State</Th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <Td>
                    <Link
                      href={`/admin/members/${member.id}`}
                      className="text-ac-2 hover:underline"
                    >
                      {member.handle}
                    </Link>
                  </Td>
                  <Td className="mn">{member.countryCode}</Td>
                  <Td>{TIER_RULES[member.riskTier].label}</Td>
                  <Td className="mn text-fg-3">{stamp(member.createdAt)}</Td>
                  <Td className={member.suspendedAt ? "text-amber" : "text-fg-3"}>
                    {member.suspendedAt ? "Suspended" : "Active"}
                  </Td>
                </tr>
              ))}
            </tbody>
          </TableScroll>
        )}
      </Card>

      {members.length === PAGE ? (
        <p className="mt-3 text-[12.5px] text-fg-4">
          Showing the {PAGE} most recent matches. Narrow the search to see further back.
        </p>
      ) : null}
    </main>
  );
}
