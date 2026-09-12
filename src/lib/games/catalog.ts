import { type GameRules, type Verification, verifyRound } from "@/lib/games/engine";
import { MERGE_RULES } from "@/lib/games/play";
import { TARGET } from "@/lib/games/merge";
import { TRAIL_RULES, FRUIT_POINTS } from "@/lib/games/trail";
import { FLOOD_RULES, MOVE_LIMIT, TILE_POINTS, SPARE_MOVE_POINTS } from "@/lib/games/flood";
import { RECALL_RULES, MATCH_POINTS, MISS_PENALTY, PAIRS } from "@/lib/games/recall";
import { BLOCKS_RULES } from "@/lib/games/blocks";
import { SPOT_RULES } from "@/lib/games/spot";
import { SOS_RULES, FIRST_SIZE, SOS_POINTS, BOARD_POINTS } from "@/lib/games/sos";

/**
 * Every game on the site, in one list.
 *
 * The list is the product decision and the security boundary at once. A slug
 * arriving from a browser — in a URL, in a request to open a round — is only a
 * game if it is a key here, and scoring a round means looking up the rules the
 * *stored* slug names and replaying against those. Nothing else decides what a
 * game is, so there is no path where a round is opened under one set of rules
 * and scored under another.
 *
 * The database has expected this since the first game shipped: GameSession.game
 * is a slug precisely so a second game would not need a migration. Adding one
 * is a rules object and an entry here.
 *
 * Every number in the copy is interpolated from the constant that actually
 * scores it. A rule written out by hand is a rule that goes stale the first
 * time someone tunes a game and reads only the code.
 */

/**
 * The order is the shelf, and the shelf is ordered by how long it takes to
 * understand the game rather than by when it was built.
 *
 * Merge went first for months because it was first. Watching someone meet it
 * cold settled the question: a player who has to be taught a rule before the
 * screen means anything has already gone. Blocks and Spot explain themselves in
 * a glance, so they lead; Merge is the one you find after you already trust the
 * place.
 */
export const GAME_SLUGS = ["blocks", "spot", "sos", "recall", "trail", "flood", "merge"] as const;

export type GameSlug = (typeof GAME_SLUGS)[number];

export type GameEntry = {
  slug: GameSlug;
  title: string;
  /** One line, on the card. What the game is, not why it is good. */
  tagline: string;
  /** The rules, in a sentence or two. Shown above the board and on the shelf. */
  how: string;
  /** How it is played, so a card can say so before a tap commits anyone. */
  input: string;
  /**
   * What the round's second number means.
   *
   * The schema stores one secondary number per round in a column called
   * bestTile, named when merge was the only game. Rather than migrate a column
   * for cosmetics, each game says what its number is and the screen prints it.
   */
  bestLabel: string;
  /** A ceiling on a submitted round, for a client that wants to stop at it. */
  maxMoves: number;
  /** Replays a submitted round under this game's rules. */
  verify: (seed: number, submitted: unknown) => Verification;
};

/**
 * Closes over one game's rules so the catalog can hold games whose moves are
 * all different types — a direction, a colour, a card, a placement.
 *
 * The alternative — a record of rules with the move type erased — needs a cast
 * to build and gives nothing back: the only thing anyone does with a rules
 * object here is verify a round with it, and that is what this returns.
 */
function playable<TMove>(rules: GameRules<TMove>) {
  return {
    maxMoves: rules.maxMoves,
    verify: (seed: number, submitted: unknown) => verifyRound(rules, seed, submitted),
  };
}

export const GAMES: Record<GameSlug, GameEntry> = {
  blocks: {
    slug: "blocks",
    title: "Blocks",
    tagline: "Drop the pieces in. Fill a line and it clears.",
    how: `Tap a piece, then a square on the board. Fill a whole row or column and it empties — two at once is worth four times one. The round ends when nothing in your hand fits anywhere.`,
    input: "Tap a piece, then a square",
    bestLabel: "Lines cleared",
    ...playable(BLOCKS_RULES),
  },
  spot: {
    slug: "spot",
    title: "Spot",
    tagline: "One tile is not like the others.",
    how: `Tap the odd one out before the bar runs out. Each level the grid grows, the difference gets smaller and the clock gets shorter. A wrong tile ends the round, and so does the clock — the points are the levels you cleared.`,
    input: "Tap the odd tile",
    bestLabel: "Level reached",
    ...playable(SPOT_RULES),
  },
  sos: {
    slug: "sos",
    title: "SOS",
    tagline: "The squared-paper game, against something that plays back.",
    how: `Write S or O in any empty square. Complete S-O-S in a line — across, down or diagonally — and it is yours, and you go again. Green squares are where your letter scores. On the first board, amber ones show what would hand it a line back — after that you are watching for those yourself. When the grid fills, the higher count takes the board: beat it and the next board is bigger. ${SOS_POINTS} a line, ${BOARD_POINTS} a board, starting at ${FIRST_SIZE}×${FIRST_SIZE}.`,
    input: "Pick a letter, tap a square",
    bestLabel: "Boards won",
    ...playable(SOS_RULES),
  },
  merge: {
    slug: "merge",
    title: "Merge",
    tagline: "Slide the tiles together and watch the numbers climb.",
    how: `Two tiles with the same number merge into one. Reach ${TARGET} to win — the board carries on afterwards.`,
    input: "Swipe or arrow keys",
    bestLabel: "Best tile",
    ...playable(MERGE_RULES),
  },
  trail: {
    slug: "trail",
    title: "Trail",
    tagline: "Eat, grow longer, and run out of room.",
    how: `Every fruit is worth ${FRUIT_POINTS}, plus one for each segment behind you. A wall or your own trail ends the run.`,
    input: "Swipe or arrow keys",
    bestLabel: "Trail length",
    ...playable(TRAIL_RULES),
  },
  flood: {
    slug: "flood",
    title: "Flood",
    tagline: "Take the whole board in as few moves as you can.",
    how: `Pick a colour and the patch in the top-left corner becomes it, swallowing everything it touches. Fill the board inside ${MOVE_LIMIT} moves: ${TILE_POINTS} points a tile, and ${SPARE_MOVE_POINTS} for every move you did not need.`,
    input: "Tap a colour",
    bestLabel: "Tiles filled",
    ...playable(FLOOD_RULES),
  },
  recall: {
    slug: "recall",
    title: "Recall",
    tagline: `${PAIRS} pairs, face down. Remember where they were.`,
    how: `Turn two cards over. A pair stays up, anything else goes back. ${MATCH_POINTS} points a pair, less ${MISS_PENALTY} for every attempt that missed.`,
    input: "Tap a card",
    bestLabel: "Best streak",
    ...playable(RECALL_RULES),
  },
};

export const GAME_LIST: readonly GameEntry[] = GAME_SLUGS.map((slug) => GAMES[slug]);

export function isGameSlug(value: unknown): value is GameSlug {
  return typeof value === "string" && (GAME_SLUGS as readonly string[]).includes(value);
}

/**
 * Scores a submitted round against the rules of the game it was opened under.
 *
 * The slug comes from the stored session row, never from the submission: a
 * round opened as Trail is scored as Trail, whatever the browser sending the
 * moves would prefer.
 */
export function verify(slug: GameSlug, seed: number, submitted: unknown): Verification {
  return GAMES[slug].verify(seed, submitted);
}
