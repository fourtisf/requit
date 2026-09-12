/**
 * The four arrow keys, drawn on the board.
 *
 * Merge opens as a silent grid with two tiles on it, and a player who does not
 * know the game has no way to learn that a keyboard is involved — the board
 * gives no feedback until the exact input nobody told them about. A sentence
 * above the board says it, but a sentence has to be read, and in a language the
 * reader may not have.
 *
 * So the keys are drawn where the eye already is, and they leave the moment the
 * first move lands. Nothing here is clickable: the point is to teach the input,
 * not to become a second one.
 */
const KEY =
  "flex size-9 items-center justify-center rounded-[7px] bg-surf-3 text-[15px] text-fg-2 " +
  "shadow-[inset_0_0_0_1px_var(--color-bd-2)]";

export function KeyCoach() {
  return (
    <div className="flex animate-pulse flex-col items-center gap-1.5 rounded-card bg-[rgba(8,9,10,.55)] p-3 backdrop-blur-[1px]">
      <div className={KEY}>↑</div>
      <div className="flex gap-1.5">
        <div className={KEY}>←</div>
        <div className={KEY}>↓</div>
        <div className={KEY}>→</div>
      </div>
    </div>
  );
}
