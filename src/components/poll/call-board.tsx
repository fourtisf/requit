import { callBoard, weekStanding } from "@/lib/poll/calls";

/**
 * This week's callers.
 *
 * The same shape as a game's board, for the same reason: a score with nobody
 * else's next to it is a number on your own screen. Ranked on days read right
 * rather than on a percentage — one lucky call is not a better week than four
 * right out of five, and a percentage board says it is.
 *
 * Hidden entirely until a day has closed. An empty board posted where a result
 * should be is a photograph of an empty room, and the first week of anything is
 * that room.
 */
export async function CallBoard({ userId }: { userId: string }) {
  const [rows, standing] = await Promise.all([callBoard(), weekStanding(userId)]);
  if (rows.length === 0) return null;

  // Shown only when they are not already on the board they are reading.
  const below = standing !== null && standing.rank > rows.length ? standing : null;

  return (
    <div className="mt-6 border-t border-bd pt-4">
      <div className="flex flex-wrap items-baseline gap-x-3">
        <h4 className="text-[13.5px] font-semibold tracking-[-0.02em]">Read the room this week</h4>
        <span className="mn ml-auto text-[11.5px] text-fg-4">settled days only</span>
      </div>

      <ol className="mt-2">
        {rows.map((row) => (
          <li
            key={row.rank}
            className="flex items-baseline gap-3 border-b border-bd py-2 text-[13px] last:border-b-0"
          >
            <span className="mn w-[18px] shrink-0 text-[11.5px] text-fg-4">{row.rank}</span>
            <span className="min-w-0 flex-1 truncate text-fg-2">
              {row.handle ?? <span className="text-fg-4">a member</span>}
            </span>
            <span className="mn shrink-0 text-[12px] tabular-nums text-fg-3">
              {row.right}/{row.settled}
            </span>
          </li>
        ))}
      </ol>

      {/* The board is not who answered most. Saying so once stops it reading as
          a ranking of how much somebody used the site. */}
      {below ? (
        <p className="mt-2 text-[12.5px] leading-[1.6] text-fg-3">
          You are <span className="mn text-fg">#{below.rank}</span> of {below.of} this week, with{" "}
          {below.right} of {below.settled} called right.
        </p>
      ) : null}

      <p className="mt-2 text-[11.5px] leading-[1.5] text-fg-4">
        Days you called the crowd right, out of days you called. Answering more often does not move
        it — reading the room does.
      </p>
    </div>
  );
}
