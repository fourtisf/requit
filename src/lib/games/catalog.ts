import { type GameRules, type Verification, verifyRound } from "@/lib/games/engine";
import { MERGE_RULES } from "@/lib/games/play";
import { TARGET } from "@/lib/games/merge";
import { TRAIL_RULES, FRUIT_POINTS } from "@/lib/games/trail";
import { FLOOD_RULES, MOVE_LIMIT, TILE_POINTS, SPARE_MOVE_POINTS } from "@/lib/games/flood";
import { RECALL_RULES, MATCH_POINTS, MISS_PENALTY, PAIRS } from "@/lib/games/recall";

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

export const GAME_SLUGS = ["merge", "trail", "flood", "recall"] as const;

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
 * Closes over one game's rules so the catalog can hold four games whose moves
 * are four different types.
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
