/**
 * The shape every game here has to have, and the one function that checks a
 * finished round.
 *
 * There is exactly one rule a game on this site must obey: the same moves, over
 * the same seed, must produce the same score on a phone and on the server. Give
 * a game that property and the browser's own opinion of how it did never has to
 * be read — the server replays the round and takes its own result. Without it,
 * a score is whatever the player's console says it is, and the moment a score
 * becomes money, someone will say it is nine million.
 *
 * That is the whole reason this file exists rather than each game growing its
 * own verifier: adding a second, third and fourth game multiplied the number of
 * places that guarantee could quietly be dropped. Now a game supplies rules and
 * a move parser, and `verifyRound` is the only thing that scores anything.
 *
 * What a replay proves, precisely: that the submitted moves are a legal game.
 * It does not prove a human made them — a program can play a legal game of any
 * of these, and for a game with hidden information (Recall's deal) a player who
 * reads it out of the page has made legal moves too. That gap is not closable
 * in a browser game, which is why the gate on turning a score into money is a
 * paying ad network's server-side callback (src/lib/ads/rewarded.ts) rather
 * than a high score.
 */

/** What every game reports, whatever it is otherwise made of. */
export type RoundState = {
  score: number;
  /** No further move is possible. The round ends here and is submitted. */
  over: boolean;
  /**
   * The round's other headline number — the highest tile, the longest trail,
   * the tiles filled, the best streak. Each game names its own in the catalog;
   * this is the one stored alongside the score.
   */
  best: number;
};

/**
 * A game in progress.
 *
 * `play` returns false for a move the board does not allow. That return value
 * is load-bearing in two directions: a client uses it to ignore input that
 * would do nothing, and the server uses it to reject a submission. A move that
 * changes nothing is one a real client cannot produce — it has the board in
 * front of it — so its presence means the list was assembled by something else.
 */
export type Engine<TMove, TState extends RoundState = RoundState> = {
  state: () => TState;
  play: (move: TMove) => boolean;
};

/**
 * Everything the server needs to score a game it has never heard of.
 *
 * `parse` takes one entry of the submitted list, not the list: the length cap
 * and the array check are the same for every game and belong in one place.
 */
export type GameRules<TMove> = {
  /** A ceiling on a submitted round, so a replay cannot be used to burn CPU. */
  maxMoves: number;
  create: (seed: number) => Engine<TMove>;
  parse: (value: unknown) => TMove | null;
};

export type VerifyFailure = "bad-moves" | "too-many-moves" | "illegal-move";

export type Verification =
  | { ok: true; score: number; moves: number; best: number }
  | { ok: false; reason: VerifyFailure; atMove: number };

/**
 * Replays a submitted round and returns the score the rules produce.
 *
 * A malformed entry fails the whole submission rather than being skipped.
 * Dropping it would score a game that differs from the one submitted, which is
 * the same as making one up.
 */
export function verifyRound<TMove>(
  rules: GameRules<TMove>,
  seed: number,
  submitted: unknown,
): Verification {
  if (!Array.isArray(submitted)) return { ok: false, reason: "bad-moves", atMove: -1 };
  if (submitted.length > rules.maxMoves) {
    return { ok: false, reason: "too-many-moves", atMove: rules.maxMoves };
  }

  const game = rules.create(seed);
  for (let index = 0; index < submitted.length; index += 1) {
    const move = rules.parse(submitted[index]);
    if (move === null) return { ok: false, reason: "bad-moves", atMove: index };
    if (!game.play(move)) return { ok: false, reason: "illegal-move", atMove: index };
  }

  const final = game.state();
  return { ok: true, score: final.score, moves: submitted.length, best: final.best };
}
