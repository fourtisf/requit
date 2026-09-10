import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { serverEnv } from "@/lib/env";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { TableScroll, Th, Td } from "@/components/ui/table";
import { referralUrl } from "@/lib/referral";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Referrals" };

export default async function ReferralsPage() {
  const session = await requireUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: { referralCode: true },
  });

  const referred = await prisma.user.findMany({
    where: { referredById: session.id },
    select: { handle: true, countryCode: true, referredAt: true },
    orderBy: { referredAt: "desc" },
    take: 100,
  });

  const link = referralUrl(serverEnv().NEXT_PUBLIC_APP_URL, user.referralCode);

  return (
    <main className="shell py-10">
      <AppNav current="/referrals" />

      <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Referrals</h1>
      <p className="mt-2.5 max-w-[62ch] text-[13.5px] leading-[1.6] text-fg-2">
        Anyone who signs up through your link is credited to you. Nothing is taken from them —
        what they earn is what they earn.
      </p>

      <div className="mt-7 grid max-w-[820px] gap-3">
        <Card>
          <CardHeader title="Your code" />
          <p className="mn text-[30px] font-semibold tracking-[0.12em]">{user.referralCode}</p>
          <p className="mn mt-4 break-all rounded-soft bg-bg-2 px-[14px] py-3 text-[12.5px] text-fg-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
            {link}
          </p>
          <p className="mt-3 text-[12px] leading-[1.55] text-fg-4">
            The code avoids the characters people mistype when reading one out — no I, L, O or U.
            Say it out loud and it still types correctly.
          </p>
        </Card>

        <Card>
          <CardHeader
            title="People you referred"
            aside={referred.length > 0 ? `${referred.length} joined` : undefined}
          />

          {referred.length === 0 ? (
            <p className="max-w-[58ch] text-[13.5px] leading-[1.65] text-fg-2">
              Nobody yet. Share the link above.
            </p>
          ) : (
            <TableScroll>
              <thead>
                <tr>
                  <Th>Joined</Th>
                  <Th>Member</Th>
                  <Th>Country</Th>
                </tr>
              </thead>
              <tbody>
                {referred.map((person) => (
                  <tr key={person.handle}>
                    <Td>{person.referredAt?.toISOString().slice(0, 10) ?? "—"}</Td>
                    <Td className="mn text-fg">{person.handle}</Td>
                    <Td className="mn">{person.countryCode}</Td>
                  </tr>
                ))}
              </tbody>
            </TableScroll>
          )}
        </Card>

        <Card tone="inset">
          <p className="text-[12.5px] text-fg-4">What you earn</p>
          <p className="mt-2 max-w-[62ch] text-[13.5px] leading-[1.65] text-fg-2">
            Not set yet. A referral share has to come out of the margin between what an advertiser
            pays and what a member is paid, and that margin is not measurable until real tasks are
            running. We would rather publish nothing than publish a rate we then have to cut.
            Everyone you refer before it is set still counts —{" "}
            <span className="text-fg">the list above is what gets credited</span>.
          </p>
          <p className="mt-3 text-[12px] text-fg-4">
            Questions: <span className="mn">{BRAND.supportEmail}</span>
          </p>
        </Card>
      </div>
    </main>
  );
}
