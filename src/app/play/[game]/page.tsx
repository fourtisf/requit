import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { AppNav } from "@/components/app-nav";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GameBoard } from "@/components/games/game-board";
import { GameMark } from "@/components/games/game-mark";
import { ScoreBoard } from "@/components/games/score-board";
import { GAMES, GAME_LIST, isGameSlug } from "@/lib/games/catalog";
import { personalBest } from "@/lib/games/session";
import { EarningNote } from "@/components/games/earning-note";
import { BRAND } from "@/lib/brand";
import { arcadeCard } from "@/lib/og";

type Props = { params: Promise<{ game: string }> };

// Every game is one page, read per request: the board's header carries the
// player's own best, which is theirs and not cacheable.
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { game } = await params;
  if (!isGameSlug(game)) return { title: "Play" };

  const entry = GAMES[game];
  const description = `${entry.tagline} Free, and no account needed to try it.`;
  return {
    title: entry.title,
    description,
    ...arcadeCard(`${entry.title} — ${BRAND.name}`, description),
  };
}

/**
 * One game.
 *
 * Open to visitors, like the shelf it hangs off. The slug is checked against
 * the catalog and nothing else: an unknown one is a 404, not a blank board, and
 * not a round opened under a game the server does not have rules for.
 */
export default async function GamePage({ params }: Props) {
  const { game } = await params;
  if (!isGameSlug(game)) notFound();

  const user = await currentUser();
  const signedIn = user !== null && !user.suspended;
  const best = signedIn ? await personalBest(user.id, game) : 0;
  const entry = GAMES[game];
  const others = GAME_LIST.filter((other) => other.slug !== game);

  return (
    <>
      {signedIn ? null : <SiteHeader links={false} />}

      <main className="shell py-10">
        {signedIn ? <AppNav current="/play" /> : null}

        <Link
          href="/play"
          className="text-[12.5px] text-fg-3 transition-colors hover:text-fg"
        >
          ← All games
        </Link>

        <div className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h1 className="text-[27px] font-semibold tracking-[-0.042em]">{entry.title}</h1>
          <span className="mn text-[12.5px] text-fg-4">{entry.input.toLowerCase()}</span>
        </div>

        {/* One line above the board, the rules below it. A paragraph of
            instructions before the grid pushes the board itself off a short
            window, and nobody reads the rules until after the first round
            anyway — the board's own button says what to press. */}
        <p className="mt-2 max-w-[64ch] text-[13.5px] leading-[1.6] text-fg-2">{entry.tagline}</p>

        {/* Beside the board once there is room for it. A 460px column on a
            1280px screen leaves two thirds of the window empty while the rules
            sit below the fold, which is a strange way to use a desktop. */}
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-12">
          <GameBoard slug={game} personalBest={best} signedIn={signedIn} />

          <div className="lg:pt-1">
            <p className="max-w-[58ch] text-[13px] leading-[1.65] text-fg-3 lg:max-w-[34ch]">
              {entry.how}{" "}
              {signedIn
                ? "Your score is checked on the server by replaying the moves you made."
                : "You do not need an account to play — sign in and your rounds start being recorded."}
            </p>

            <ScoreBoard game={entry} viewer={signedIn ? user.id : null} />
          </div>
        </div>

        <div className="mt-8">
          <EarningNote signedIn={signedIn} />
        </div>

        <div className="mt-8">
          <p className="mn text-[11.5px] uppercase tracking-[0.08em] text-fg-4">Also on the shelf</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {others.map((other) => (
              <Link
                key={other.slug}
                href={`/play/${other.slug}`}
                className="flex items-center gap-3 rounded-card px-3 py-2.5 transition-colors surface-raised hover:bg-surf-2"
              >
                <GameMark slug={other.slug} />
                <span className="pr-2">
                  <span className="block text-[14px] font-semibold tracking-[-0.02em]">
                    {other.title}
                  </span>
                  <span className="mt-0.5 block max-w-[28ch] text-[12px] leading-[1.5] text-fg-3">
                    {other.tagline}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      </main>

      {signedIn ? null : <SiteFooter />}
    </>
  );
}
