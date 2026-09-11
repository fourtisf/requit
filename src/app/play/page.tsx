import { currentUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardHeader } from "@/components/ui/card";
import { MergeBoard } from "@/components/games/merge-board";
import { personalBest } from "@/lib/games/session";
import { earningsStatus } from "@/lib/ads/rewarded";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Play",
  description: `A quick merge game. Free, no account needed to try it.`,
};
export const dynamic = "force-dynamic";

/**
 * Open to visitors on purpose.
 *
 * It is the only thing on this site a stranger can actually try — everything
 * else is a description of work that is not live yet. Putting it behind sign-in
 * would waste the one page that answers "is there a product here" by letting
 * someone find out for themselves.
 */
export default async function PlayPage() {
  const user = await currentUser();
  const signedIn = user !== null && !user.suspended;
  const best = signedIn ? await personalBest(user.id) : 0;
  const earnings = earningsStatus();

  return (
    <>
      {signedIn ? null : <SiteHeader links={false} />}

      <main className="shell py-10">
        {signedIn ? <AppNav current="/play" /> : null}

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Play</h1>
          <span className="mn text-[12.5px] text-fg-4">merge</span>
        </div>

        <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
          Our own game. Rounds are short, the rules fit in a sentence, and{" "}
          {signedIn
            ? "every score is checked on the server by replaying the moves you made."
            : "you do not need an account to play — sign in and your rounds start being recorded."}
        </p>

        {/*
          The honest state of the earning half. A game showing a reward counter
          while no advertiser was paying would be the company paying its members
          out of its own float — the arrangement this product exists to not be.
          It says so instead.
        */}
        {!earnings.earning ? (
          <Card className="mt-6 max-w-[62ch]">
            <CardHeader title="This game does not pay yet" />
            <p className="text-[13.5px] leading-[1.65] text-fg-2">
              Games like this one earn through rewarded video, and {BRAND.name} has no ad network
              connected. Until one is, there is no advertiser money behind a round — so scores are
              recorded and nothing is credited. We would rather say that than show you a number
              that never turns into a payout.
            </p>
          </Card>
        ) : null}

        <div className="mt-7">
          <MergeBoard personalBest={best} signedIn={signedIn} />
        </div>
      </main>

      {signedIn ? null : <SiteFooter />}
    </>
  );
}
