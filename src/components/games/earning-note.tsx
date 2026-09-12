import { BRAND } from "@/lib/brand";
import { Card, CardHeader } from "@/components/ui/card";
import { canEarn } from "@/lib/ads/rewarded";

/**
 * The honest state of the earning half, and the one thing a visitor has to do
 * about it in advance.
 *
 * A game showing a reward counter while no advertiser was paying would be the
 * company paying its members out of its own float — the arrangement this
 * product exists to not be. So the first paragraph is the refusal, and it stays
 * first.
 *
 * The second is for visitors, and it is a condition rather than a promise: a
 * round played without an account is not written down at all, so there is no
 * one for a credit to be owed to afterwards. Saying that before someone plays
 * is the difference between an account they chose and a claim they lost.
 */
export function EarningNote({ signedIn }: { signedIn: boolean }) {
  const status = canEarn({ signedIn });
  if (status.earning) return null;

  return (
    <Card className="max-w-[62ch]">
      <CardHeader title="These games do not pay yet" />
      <p className="text-[13.5px] leading-[1.65] text-fg-2">
        Games like these earn through rewarded video, and {BRAND.name} has no ad network
        connected. Until one is, there is no advertiser money behind a round — so scores are
        recorded and nothing is credited. We would rather say that than show you a number that
        never turns into a payout.
      </p>

      <p className="mt-3.5 text-[13.5px] leading-[1.65] text-fg-2">
        {signedIn ? (
          <>
            Your rounds are recorded against your account, which is what a credit would need to
            be attached to. Nothing accrues meanwhile, and nothing is owed.
          </>
        ) : (
          <>
            When that changes, only rounds played while signed in can be credited — a round played
            without an account is not written down at all, so there would be nobody to pay.{" "}
            <a href="/signin" className="text-ac-2 underline underline-offset-4">
              Make one now
            </a>{" "}
            and you are on the right side of that the day it happens. The games stay free either
            way.
          </>
        )}
      </p>
    </Card>
  );
}
