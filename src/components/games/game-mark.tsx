import type { ReactNode } from "react";
import type { GameSlug } from "@/lib/games/catalog";
import { Glyph } from "@/components/games/glyph";

/**
 * A little still life of each game, for the shelf.
 *
 * Four cards of text would all look the same, and a player choosing between
 * games is choosing on feel. These are the boards in miniature — not
 * screenshots, not animations, just enough of each one to be recognised after
 * you have played it once.
 */

const CELL = "rounded-[2px]";

function Frame({ columns = 4, children }: { columns?: 2 | 4; children: ReactNode }) {
  return (
    <div
      aria-hidden
      className={`grid size-[58px] shrink-0 gap-[3px] rounded-[10px] bg-surf p-[5px] shadow-[inset_0_0_0_1px_var(--color-bd)] ${
        columns === 2 ? "grid-cols-2" : "grid-cols-4"
      }`}
    >
      {children}
    </div>
  );
}

function Cells({ fill }: { fill: (index: number) => string }) {
  return (
    <>
      {Array.from({ length: 16 }, (_, index) => (
        <div key={index} className={`${CELL} ${fill(index)}`} />
      ))}
    </>
  );
}

const TRAIL = new Set([5, 6, 7, 11]);
const FLOOD: Record<number, string> = { 0: "#6bcba5", 1: "#6bcba5", 4: "#6bcba5", 5: "#6bcba5" };
const FLOOD_REST = ["#e8c68b", "#7fa6d9", "#b98cd4", "#d98f77", "#8fa0ad"];

export function GameMark({ slug }: { slug: GameSlug }) {
  if (slug === "merge") {
    const tiles: Record<number, string> = {
      5: "bg-surf-3",
      6: "bg-[rgba(107,203,165,.3)]",
      9: "bg-[rgba(107,203,165,.5)]",
      10: "bg-[rgba(232,198,139,.55)]",
    };
    return (
      <Frame>
        <Cells fill={(index) => tiles[index] ?? "bg-surf-2/40"} />
      </Frame>
    );
  }

  if (slug === "trail") {
    return (
      <Frame>
        <Cells
          fill={(index) =>
            index === 4 ? "bg-ac-2" : TRAIL.has(index) ? "bg-[rgba(107,203,165,.45)]" : index === 14 ? "bg-amber" : "bg-surf-2/40"
          }
        />
      </Frame>
    );
  }

  if (slug === "flood") {
    return (
      <Frame>
        {Array.from({ length: 16 }, (_, index) => (
          <div
            key={index}
            className={CELL}
            style={{ background: FLOOD[index] ?? FLOOD_REST[index % FLOOD_REST.length] }}
          />
        ))}
      </Frame>
    );
  }

  // Recall: two cards turned over, two still down.
  const faces: Record<number, number> = { 5: 0, 10: 3 };
  return (
    <Frame columns={2}>
      {[5, 1, 2, 10].map((cell, index) => (
        <div
          key={index}
          className={`flex items-center justify-center rounded-[4px] ${
            faces[cell] === undefined ? "bg-surf-2/50" : "bg-ac-dim text-ac-2"
          }`}
        >
          {faces[cell] === undefined ? (
            <span className="size-1 rounded-full bg-fg-4/70" />
          ) : (
            <Glyph shape={faces[cell]!} className="size-[9px]" />
          )}
        </div>
      ))}
    </Frame>
  );
}
