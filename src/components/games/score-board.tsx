import Link from "next/link";
import { type GameEntry } from "@/lib/games/catalog";
import { standing, todaysBoard, todaysResult } from "@/lib/games/board";
import { prizeWeek } from "@/lib/games/prizes";

/**
 * Today's board for one game, and where the reader stands.
 *
 * It answers the only fair question a scoring game can be asked while nothing
 * is paying: what is the score for. Before this, it was a number on your own
 * screen and nothing else — which is not an answer.
 *
 * Today rather than this week, because today is the one everybody played the
 * same board on. A weekly best-of ranks luck and volume as much as skill: the
 * kind opening beats the careful hour. The week is still here, as one line
 * about where the reader stands in it.
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
  const [today, mine, weekly] = await Promise.all([
    todaysBoard(game.slug, 10),
    viewer ? todaysResult(viewer, game.slug) : Promise.resolve(null),
    viewer ? standing(viewer, game.slug, week) : Promise.resolve(null),
  ]);

  const rows = today.rows;
  const yours = rows.findIndex((row) => mine !== null && row.score === mine.score);

  return (
    <section className="mt-8 max-w-[46ch] lg:mt-7">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h2 className="text-[15px] font-semibold tracking-[-0.02em]">Today&rsquo;s board</h2>
        <span className="mn text-[11.5px] text-fg-4">
          {new Date().toISOString().slice(0, 10)} UTC
        </span>
      </div>

      <p className="mt-1.5 max-w-[46ch] text-[12.5px] leading-[1.55] text-fg-3">
        Everybody gets the same board today, so these are comparable. Your first finished round is
        the one that counts — replaying it until it goes well would make the number meaningless.
      </p>

      {rows.length === 0 ? (
        <p className="mt-3 text-[13px] leading-[1.6] text-fg-3">
          Nobody has finished today&rsquo;s {game.title} board yet. It starts with whoever does.
        </p>
      ) : (
        <ol className="mt-3">
          {rows.map((row, index) => {
            const you = mine !== null && index === yours;
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

      {/* Your own result, said plainly — including when it is nowhere near the
          ten rows above, which is where nearly everyone is. */}
      {mine !== null ? (
        <p className="mt-3 text-[13px] text-fg-2">
          {yours >= 0 ? (
            <>
              You are <span className="mn text-fg">#{yours + 1}</span> today with{" "}
              <span className="mn text-ac-2">{mine.score}</span>.
            </>
          ) : (
            <>
              You finished today&rsquo;s board with <span className="mn text-ac-2">{mine.score}</span>
              , outside the ten above.
            </>
          )}
        </p>
      ) : null}

      {viewer !== null && mine === null ? (
        <p className="mt-3 text-[13px] text-fg-3">You have not played today&rsquo;s board yet.</p>
      ) : null}

      {weekly && weekly.rank !== null ? (
        <p className="mt-1.5 text-[12.5px] text-fg-3">
          Across every board this week you are <span className="mn text-fg-2">#{weekly.rank}</span>{" "}
          with <span className="mn text-fg-2">{weekly.best}</span>.
        </p>
      ) : null}

      {viewer === null ? (
        <p className="mt-3 text-[13px] leading-[1.6] text-fg-3">
          Rounds played without an account are not recorded, so they cannot be ranked.{" "}
          <Link href="/signin" className="text-ac-2 underline underline-offset-4">
            Sign in or create one
          </Link>{" "}
          and your scores go on the board.
        </p>
      ) : null}
    </section>
  );
}
