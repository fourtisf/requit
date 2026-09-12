"use client";

import { useCallback, useState } from "react";
import { SHAPES, SIZE, type BlocksMove, coverage, createBlocks, fits } from "@/lib/games/blocks";
import { GAMES } from "@/lib/games/catalog";
import { useRound } from "@/components/games/use-round";
import { RoundFrame } from "@/components/games/round-frame";

/**
 * Blocks: the board, and the three pieces waiting under it.
 *
 * Tap a piece, tap a square. The squares the piece will actually go on are
 * marked as soon as it is picked up, because a board that silently refuses a
 * tap is the same board that made people ask what this game wanted from them.
 */
export function BlocksBoard({
  personalBest,
  signedIn,
}: {
  personalBest: number;
  signedIn: boolean;
}) {
  const round = useRound({
    game: "blocks",
    signedIn,
    personalBest,
    create: useCallback((seed: number) => createBlocks(seed), []),
  });
  const { state, status, send } = round;

  const [held, setHeld] = useState(0);
  const [hover, setHover] = useState<number | null>(null);

  const playing = status === "playing";
  const board = state?.board ?? new Array<boolean>(SIZE * SIZE).fill(false);
  const tray = state?.tray ?? [null, null, null];

  // The piece in hand, falling back to whichever slot still has one: a tray
  // that just refilled must not leave the player holding an empty slot.
  const shape = tray[held] ?? null;
  const inHand = shape === null ? tray.findIndex((slot) => slot !== null) : held;
  const holding = inHand >= 0 ? (tray[inHand] ?? null) : null;

  const preview =
    holding !== null && hover !== null && fits(board, SHAPES[holding]!, hover)
      ? new Set(coverage(SHAPES[holding]!, hover))
      : null;

  function place(cell: number) {
    if (holding === null) return;
    const move: BlocksMove = { piece: inHand, cell };
    // No need to move the selection afterwards: `inHand` falls through to a
    // slot that still holds something, including a tray that just refilled.
    if (send(move)) setHover(null);
  }

  return (
    <RoundFrame
      game={GAMES.blocks}
      round={round}
      signedIn={signedIn}
      score={state?.score ?? 0}
      secondary={state?.lines ?? 0}
      hint="Tap a piece, then a square."
      ended="Nothing else fits."
    >
      <div className="grid select-none grid-cols-8 gap-[3px] rounded-card bg-surf p-2 shadow-[inset_0_0_0_1px_var(--color-bd)]">
        {board.map((filled, cell) => {
          const ghost = preview?.has(cell) ?? false;
          const open = playing && holding !== null && fits(board, SHAPES[holding]!, cell);

          return (
            <button
              key={cell}
              type="button"
              disabled={!playing}
              onClick={() => place(cell)}
              onMouseEnter={() => setHover(cell)}
              onMouseLeave={() => setHover((at) => (at === cell ? null : at))}
              aria-label={`Square ${cell + 1}`}
              className={`aspect-square rounded-[4px] transition-colors duration-100 ${
                filled
                  ? "bg-[rgba(107,203,165,.62)]"
                  : ghost
                    ? "bg-[rgba(107,203,165,.32)]"
                    : open
                      ? "bg-surf-2/70 shadow-[inset_0_0_0_1px_rgba(107,203,165,.22)]"
                      : "bg-surf-2/40"
              }`}
            />
          );
        })}
      </div>

      <div className="mt-3 flex items-start gap-2">
        {tray.map((slot, index) => (
          <button
            key={index}
            type="button"
            disabled={!playing || slot === null}
            onClick={() => setHeld(index)}
            aria-label={slot === null ? `Piece ${index + 1}, used` : `Take piece ${index + 1}`}
            className={`flex h-[72px] flex-1 items-center justify-center rounded-card transition-colors ${
              slot === null
                ? "bg-surf/40"
                : index === inHand
                  ? "bg-surf-3 shadow-[inset_0_0_0_1px_rgba(107,203,165,.4)]"
                  : "bg-surf shadow-[inset_0_0_0_1px_var(--color-bd)] hover:bg-surf-2"
            }`}
          >
            {slot === null ? null : <PieceMark shape={slot} lit={index === inHand} />}
          </button>
        ))}
      </div>
    </RoundFrame>
  );
}

/** A piece drawn at tray size, so what you pick is what you place. */
function PieceMark({ shape, lit }: { shape: number; lit: boolean }) {
  const cells = SHAPES[shape]!;
  const width = Math.max(...cells.map(({ x }) => x)) + 1;
  const height = Math.max(...cells.map(({ y }) => y)) + 1;
  const filled = new Set(cells.map(({ x, y }) => y * width + x));

  return (
    <div
      className="grid gap-[2px]"
      style={{ gridTemplateColumns: `repeat(${width}, 13px)` }}
      aria-hidden
    >
      {Array.from({ length: width * height }, (_, index) => (
        <div
          key={index}
          className={`size-[13px] rounded-[3px] ${
            filled.has(index)
              ? lit
                ? "bg-[rgba(107,203,165,.75)]"
                : "bg-[rgba(107,203,165,.5)]"
              : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}
