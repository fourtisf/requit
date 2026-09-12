import { describe, expect, it } from "vitest";
import { GAMES, GAME_LIST, GAME_SLUGS, isGameSlug, verify } from "@/lib/games/catalog";
import { PLAYERS } from "@/test/players";

/**
 * One contract, checked against every game on the shelf.
 *
 * These are deliberately written as a loop rather than four copies: the point
 * of the catalog is that a fifth game cannot arrive without meeting the same
 * terms, and a test that has to be copied to cover it would be the first thing
 * skipped on a Friday.
 */

describe("the shelf", () => {
  it("lists each game once, in order", () => {
    expect(GAME_LIST.map((game) => game.slug)).toEqual([...GAME_SLUGS]);
    expect(new Set(GAME_SLUGS).size).toBe(GAME_SLUGS.length);
  });

  it("recognises its own slugs and nothing else", () => {
    for (const slug of GAME_SLUGS) expect(isGameSlug(slug)).toBe(true);
    for (const impostor of ["", "MERGE", "merge ", "poker", null, 3, {}, ["merge"]]) {
      expect(isGameSlug(impostor)).toBe(false);
    }
  });

  it("gives every game the copy a card needs", () => {
    for (const game of GAME_LIST) {
      expect(game.title.length).toBeGreaterThan(0);
      expect(game.tagline.length).toBeGreaterThan(0);
      expect(game.how.length).toBeGreaterThan(0);
      expect(game.input.length).toBeGreaterThan(0);
      expect(game.bestLabel.length).toBeGreaterThan(0);
      expect(game.maxMoves).toBeGreaterThan(0);
    }
  });

  it("keys each entry by its own slug", () => {
    // A copy-pasted entry pointing at another game's rules would score rounds
    // of one game with the rules of another, and nothing else would notice.
    for (const slug of GAME_SLUGS) expect(GAMES[slug].slug).toBe(slug);
  });
});

describe.each(GAME_SLUGS)("%s", (slug) => {
  const play = PLAYERS[slug];
  const SEED = 2024;

  it("scores a played round exactly as the player saw it", () => {
    const round = play(SEED);
    expect(round.moves.length).toBeGreaterThan(0);

    expect(verify(slug, SEED, round.moves)).toEqual({
      ok: true,
      score: round.score,
      moves: round.moves.length,
      best: round.best,
    });
  });

  it("scores the same round the same way twice", () => {
    const round = play(SEED);
    expect(verify(slug, SEED, round.moves)).toEqual(verify(slug, SEED, round.moves));
  });

  it("refuses a round that is not a list of moves", () => {
    for (const submitted of [null, undefined, "left", 7, { moves: [] }]) {
      const result = verify(slug, SEED, submitted);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.reason).toBe("bad-moves");
    }
  });

  it("refuses a round with an entry that is not a move", () => {
    const round = play(SEED);
    const result = verify(slug, SEED, [...round.moves.slice(0, 1), { nice: "try" }]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("bad-moves");
      expect(result.atMove).toBe(1);
    }
  });

  it("refuses a round longer than the game allows", () => {
    const round = play(SEED);
    const filler = round.moves[0];
    const flood = new Array<unknown>(GAMES[slug].maxMoves + 1).fill(filler);

    const result = verify(slug, SEED, flood);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe("too-many-moves");
  });

  it("refuses a round padded past the end of the game", () => {
    // Every game here ends by itself, and a move after that end is the cheapest
    // thing to try: it costs nothing and would score a game nobody played.
    const round = play(SEED);
    expect(round.over).toBe(true);

    const result = verify(slug, SEED, [...round.moves, round.moves[0]]);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("illegal-move");
      expect(result.atMove).toBe(round.moves.length);
    }
  });

  it("does not score one round as another game's", () => {
    // The slug that scores a round comes from the stored row, so this is what
    // stops a move list being worth more under a different set of rules.
    const round = play(SEED);
    for (const other of GAME_SLUGS) {
      if (other === slug) continue;
      const result = verify(other, SEED, round.moves);
      if (result.ok) expect(result.score).not.toBe(round.score);
    }
  });
});
