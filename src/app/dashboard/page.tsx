import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { BRAND } from "@/lib/brand";
import { Card, CardHeader } from "@/components/ui/card";
import { StatGrid, Stat } from "@/components/ui/stat";
import { Chip, ChipRow } from "@/components/ui/chip";
import { UNKNOWN_COUNTRY } from "@/lib/country";

export const metadata = { title: "Dashboard" };

/**
 * Phase 0 acceptance: a signed-in user lands here.
 *
 * Every figure is null on purpose. Tasks arrive in Phase 1, balances in Phase 2 —
 * until the queries behind them exist, the tiles show an em dash rather than a
 * zero that looks computed.
 */
export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");

  const { handle, countryCode, riskTier } = session.user;
  const countryKnown = countryCode !== UNKNOWN_COUNTRY;

  return (
    <main className="shell py-14">
      <header className="flex flex-wrap items-center gap-4">
        <div>
          <p className="text-[12.5px] text-fg-4">Signed in as</p>
          <p className="mn mt-1 text-[19px] font-semibold tracking-[-0.03em]">{handle}</p>
        </div>
        <form
          className="ml-auto"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="rounded-full bg-surf-2 px-4 py-2 text-[12.5px] text-fg-2 shadow-[inset_0_0_0_1px_var(--color-bd-2)] transition-colors hover:text-fg"
          >
            Sign out
          </button>
        </form>
      </header>

      <ChipRow>
        <Chip>{countryKnown ? countryCode : "Country unknown"}</Chip>
        <Chip tone={riskTier === "FLAGGED" ? "amber" : "neutral"}>{riskTier.toLowerCase()}</Chip>
      </ChipRow>

      <StatGrid className="mt-8">
        <Stat value={null} label="available to withdraw" />
        <Stat value={null} label="pending confirmation" />
        <Stat value={null} label="paid to you to date" />
        <Stat value={null} label="tasks available" />
      </StatGrid>

      <Card className="mt-3">
        <CardHeader title="Tasks" aside="Phase 1" />
        <p className="max-w-[62ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
          {BRAND.name} has no live offer inventory yet. Reward, eligibility, deadline and any
          purchase requirement will be shown here before you start a task — never after.
        </p>
        {!countryKnown ? (
          <p className="mt-4 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[12.5px] leading-[1.5] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
            We could not determine your country at sign-up, and offers are matched by country.
            You will be asked to confirm it before the first task.
          </p>
        ) : null}
      </Card>
    </main>
  );
}
