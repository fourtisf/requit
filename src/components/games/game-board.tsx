import type { GameSlug } from "@/lib/games/catalog";
import { BlocksBoard } from "@/components/games/blocks-board";
import { SpotBoard } from "@/components/games/spot-board";
import { MergeBoard } from "@/components/games/merge-board";
import { TrailBoard } from "@/components/games/trail-board";
import { FloodBoard } from "@/components/games/flood-board";
import { RecallBoard } from "@/components/games/recall-board";

/**
 * The one place a slug turns into a board.
 *
 * A record rather than a switch, so TypeScript refuses to compile a game that
 * has been added to the catalog and forgotten here — which is the failure that
 * would otherwise show up as a blank page under a working link.
 */
const BOARDS: Record<GameSlug, typeof MergeBoard> = {
  blocks: BlocksBoard,
  spot: SpotBoard,
  merge: MergeBoard,
  trail: TrailBoard,
  flood: FloodBoard,
  recall: RecallBoard,
};

export function GameBoard({
  slug,
  personalBest,
  signedIn,
}: {
  slug: GameSlug;
  personalBest: number;
  signedIn: boolean;
}) {
  const Board = BOARDS[slug];
  return <Board personalBest={personalBest} signedIn={signedIn} />;
}
