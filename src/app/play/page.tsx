import Link from "next/link";
import { currentUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Card, CardHeader } from "@/components/ui/card";
import { Chip } from "@/components/ui/chip";
import { GameMark } from "@/components/games/game-mark";
import { GAME_LIST } from "@/lib/games/catalog";
import { personalBests } from "@/lib/games/session";
import { earningsStatus } from "@/lib/ads/rewarded";
import { BRAND } from "@/lib/brand";

export const metadata = {
  title: "Play",
  description: `${GAME_LIST.length} short games, made by us. Free, and no account needed to try them.`,
};
export const dynamic = "force-dynamic";

/**
 * The shelf.
 *
 * Open to visitors on purpose. It is the only thing on this site a stranger can
 * actually try — everything else is a description of work that is not live yet.
 * Putting it behind sign-in would waste the one page that answers "is there a
 * product here" by letting someone find out for themselves.
 *
 * Four games rather than one for the same reason: whoever bounces off a puzzle
 * in ten seconds will play the arcade one, and the point of the page is that
 * they play something.
 */
export default async function PlayPage() {
  const user = await currentUser();
  const signedIn = user !== null && !user.suspended;
  const bests = signedIn ? await personalBests(user.id) : null;
  const earnings = earningsStatus();

  return (
    <>
      {signedIn ? null : <SiteHeader links={false} />}

      <main className="shell py-10">
        {signedIn ? <AppNav current="/play" /> : null}

        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[27px] font-semibold tracking-[-0.042em]">Play</h1>
          <span className="mn text-[12.5px] text-fg-4">{GAME_LIST.length} games</span>
        </div>

        <p className="mt-2.5 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">
          Our own games. Rounds are short, the rules fit in a sentence, and{" "}
          {signedIn
            ? "every score is checked on the server by replaying the moves you made."
            : "you do not need an account to play — sign in and your rounds start being recorded."}
        </p>

        <div className="mt-7 grid gap-3 sm:grid-cols-2">
          {GAME_LIST.map((game) => (
            <Link
              key={game.slug}
              href={`/play/${game.slug}`}
              className="group rounded-card p-[clamp(16px,2vw,22px)] transition-colors surface-raised hover:bg-surf-2"
            >
              <div className="flex items-start gap-4">
                <GameMark slug={game.slug} />
                <div className="min-w-0">
                  <h2 className="text-[16.5px] font-semibold tracking-[-0.025em]">
                    {game.title}{" "}
                    <span className="text-fg-4 transition-transform group-hover:text-fg-3">→</span>
                  </h2>
                  <p className="mt-1 text-[13px] leading-[1.55] text-fg-2">{game.tagline}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-1.5">
                    <Chip>{game.input}</Chip>
                    {bests ? (
                      <Chip tone={bests[game.slug] > 0 ? "accent" : "neutral"}>
                        {bests[game.slug] > 0 ? `Your best ${bests[game.slug]}` : "Not played yet"}
                      </Chip>
                    ) : null}
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {/*
          The honest state of the earning half. A game showing a reward counter
          while no advertiser was paying would be the company paying its members
          out of its own float — the arrangement this product exists to not be.
          It says so instead.
        */}
        {!earnings.earning ? (
          <Card className="mt-7 max-w-[62ch]">
            <CardHeader title="These games do not pay yet" />
            <p className="text-[13.5px] leading-[1.65] text-fg-2">
              Games like these earn through rewarded video, and {BRAND.name} has no ad network
              connected. Until one is, there is no advertiser money behind a round — so scores are
              recorded and nothing is credited. We would rather say that than show you a number
              that never turns into a payout.
            </p>
          </Card>
        ) : null}
      </main>

      {signedIn ? null : <SiteFooter />}
    </>
  );
}
