/**
 * The seeded generator every game on this site shares.
 *
 * It lives on its own rather than inside one game because it is the thing that
 * makes server-side scoring possible at all: a round is checked by replaying
 * it, and a replay only reproduces the original if every "random" value in it
 * came from a stream both sides can regenerate. A game that reached for
 * Math.random anywhere — a tile, a fruit, a shuffle — would be unverifiable,
 * and an unverifiable score is one anybody can type into a console.
 *
 * mulberry32: small, fast, and — the part that matters here — identical in
 * every JavaScript runtime, which is what lets the server recompute a browser's
 * game exactly.
 */
export function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Fisher–Yates against a seeded stream, so a deal can be dealt twice.
 *
 * Drawing from the end and swapping — rather than splicing out of a shrinking
 * array — keeps every position equally likely, which is the whole point of
 * shuffling a deck someone is about to memorise.
 */
export function shuffle<T>(items: readonly T[], next: () => number): T[] {
  const out = [...items];
  for (let index = out.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(next() * (index + 1));
    [out[index], out[swap]] = [out[swap]!, out[index]!];
  }
  return out;
}

/** An integer in [0, bound), from the same stream. */
export function below(bound: number, next: () => number): number {
  return Math.floor(next() * bound);
}
