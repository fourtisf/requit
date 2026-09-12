import Link from "next/link";
import { type GameEntry } from "@/lib/games/catalog";
import { topScores, standing } from "@/lib/games/board";
import { prizeWeek } from "@/lib/games/prizes";

/**
 * This week's top ten for one game, and where the reader stands in it.
 *
 * It answers the only fair question a scoring game can be asked while nothing
 * is paying: what is the score for. Before this, it was a number on your own
 * screen and nothing else — which is not an answer.
 *
 * It promises nothing. There is no prize here and no hint of one; the gate that
 * would have to open first, and what would have to be true to open it, is
 * written down in lib/games/prizes.ts rather than implied on screen.
 */
export async function ScoreBoard({
  game,
  viewer,
}: {
  game: GameEntry;
  /** Null for a visitor, who has no standing to show and is told why. */
  viewer: string | null;
}) {
  const week = prizeWeek();
  const [rows, mine] = await Promise.all([
    topScores(game.slug, week, 10),
    viewer ? standing(viewer, game.slug, week) : Promise.resolve(null),
  ]);

  const listed = mine?.rank !== null && (mine?.rank ?? 0) <= rows.length;

  return (
    <section className="mt-8 max-w-[46ch] lg:mt-7">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Top this week</h2>
        <span className="mn text-[11.5px] text-fg-4">
          {week.start.toISOString().slice(5, 10)} — {week.end.toISOString().slice(5, 10)} UTC
        </span>
      </div>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[1.6] text-fg-3">
          Nobody has finished a round of {game.title} this week. The board starts with whoever does.
        </p>
      ) : (
        <ol className="mt-3">
          {rows.map((row) => {
            const you = mine !== null && mine.rank === row.rank && mine.best === row.score;
            return (
              <li
                key={row.rank}
                className={`flex items-baseline gap-3 border-b border-bd py-[9px] text-[13px] ${
                  you ? "text-fg" : "text-fg-2"
                }`}
              >
                <span className="mn w-[2.2ch] shrink-0 text-right text-fg-4">{row.rank}</span>
                <span className="min-w-0 flex-1 truncate">
                  {row.handle ?? <span className="mn text-fg-4">anonymous</span>}
                  {you ? <span className="ml-2 text-[11.5px] text-ac-2">you</span> : null}
                </span>
                <span className="mn shrink-0 tabular-nums">{row.score}</span>
              </li>
            );
          })}
        </ol>
      )}

      {/* Where you stand, said plainly, including when that is outside the ten
          rows above — which is where nearly everyone is. */}
      {mine && mine.rank !== null && !listed ? (
        <p className="mt-3 text-[13px] text-fg-2">
          You are <span className="mn text-fg">#{mine.rank}</span> this week with{" "}
          <span className="mn text-ac-2">{mine.best}</span>.
        </p>
      ) : null}

      {mine && mine.rank === null ? (
        <p className="mt-3 text-[13px] text-fg-3">
          You have not finished a round this week yet.
        </p>
      ) : null}

      {viewer === null ? (
        <p className="mt-3 text-[13px] leading-[1.6] text-fg-3">
          Rounds played without an account are not recorded, so they cannot be ranked.{" "}
          <Link href="/signin" className="text-ac-2 underline underline-offset-4">
            Sign in
          </Link>{" "}
          and your scores go on the board.
        </p>
      ) : null}
    </section>
  );
}
