import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { AppNav } from "@/components/app-nav";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ToggleRow } from "@/components/ui/toggle-row";
import { UNKNOWN_COUNTRY } from "@/lib/country";
import { TIER_RULES } from "@/lib/risk";
import { BRAND } from "@/lib/brand";
import { saveSettings } from "./actions";

export const metadata = { title: "Settings" };

/**
 * The prototype's proof table promises "can be hidden in your settings". This is
 * that page — the promise was printed before the page existed.
 */
export default async function SettingsPage() {
  const session = await requireUser();

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.id },
    select: {
      email: true,
      handle: true,
      countryCode: true,
      riskTier: true,
      publicPayouts: true,
      notifyRewards: true,
      notifyWithdrawals: true,
      notifyDisputes: true,
    },
  });

  const countryKnown = user.countryCode !== UNKNOWN_COUNTRY;
  const rule = TIER_RULES[user.riskTier];

  return (
    <main className="shell py-10">
      <AppNav current="/settings" />

      <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Settings</h1>

      <form action={saveSettings} className="mt-7 flex max-w-[640px] flex-col gap-3">
        <Card>
          <CardHeader title="Account" />
          <dl className="text-[13.5px]">
            <div className="flex justify-between gap-4 border-b border-bd py-3">
              <dt className="text-fg-4">Email</dt>
              <dd className="mn">{user.email}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-bd py-3">
              <dt className="text-fg-4">Handle</dt>
              <dd className="mn">{user.handle}</dd>
            </div>
            <div className="flex justify-between gap-4 py-3">
              <dt className="text-fg-4">Withdrawals</dt>
              <dd className="text-right">
                {rule.label}
                <span className="mt-0.5 block max-w-[38ch] text-[12px] leading-[1.5] text-fg-3">
                  {rule.meaning}
                </span>
              </dd>
            </div>
          </dl>
        </Card>

        <Card>
          <CardHeader title="Country" />
          {countryKnown ? (
            <p className="max-w-[58ch] text-[13px] leading-[1.6] text-fg-2">
              Set to <span className="mn text-fg">{user.countryCode}</span> from where you signed
              up. Offers are matched by country, so this is not editable — a country you can
              retype is a country anyone can claim.{" "}
              <a href={`mailto:${BRAND.supportEmail}`} className="text-ac-2 underline underline-offset-4">
                Tell us if you have moved
              </a>
              .
            </p>
          ) : (
            <>
              <p className="max-w-[58ch] text-[13px] leading-[1.6] text-fg-2">
                We could not tell where you signed up from, and offers are matched by country.
                Set it once — after that it is fixed.
              </p>
              <input
                name="countryCode"
                maxLength={2}
                placeholder="GB"
                aria-label="Two-letter country code"
                className="mn mt-4 w-24 rounded-soft bg-bg-2 px-[14px] py-2.5 text-center text-[14.5px] uppercase text-fg placeholder:text-fg-4 shadow-[inset_0_0_0_1px_var(--color-bd-2)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ac)]"
              />
            </>
          )}
        </Card>

        <Card>
          <CardHeader title="Public profile" />
          <ToggleRow
            name="publicPayouts"
            defaultChecked={user.publicPayouts}
            label="Show my handle on the public payout table"
            description={
              <>
                Amounts and transaction hashes are always public — a payout nobody can verify is
                not proof of anything. This controls your handle only. With it off you still
                appear, as <span className="mn">anonymous</span>.
              </>
            }
          />
        </Card>

        <Card>
          <CardHeader title="Email" />
          <ToggleRow
            name="notifyRewards"
            defaultChecked={user.notifyRewards}
            label="When a task is confirmed"
            description="The network confirmed your completion and the reward is on its way to available."
          />
          <ToggleRow
            name="notifyWithdrawals"
            defaultChecked={user.notifyWithdrawals}
            label="When a withdrawal settles"
            description="Sent once the transaction is confirmed on chain, with the hash."
          />
          <ToggleRow
            name="notifyDisputes"
            defaultChecked={user.notifyDisputes}
            label="When a dispute changes"
            description="Every status change on a dispute you opened, including the ones that go against you."
          />
          <p className="mt-4 text-[12px] leading-[1.55] text-fg-4">
            Sign-in codes are not on this list. They are how you get into the account, so they are
            always sent.
          </p>
        </Card>

        <div>
          <Button type="submit" size="lg">
            Save
          </Button>
        </div>
      </form>
    </main>
  );
}
