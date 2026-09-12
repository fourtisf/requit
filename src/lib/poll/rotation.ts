import { rng, shuffle } from "@/lib/games/rng";
import { QUESTIONS, type PollQuestion } from "@/lib/poll/questions";
import { dayOf } from "@/lib/games/daily";

/**
 * Which question today is.
 *
 * Everyone gets the same one on the same day — the same rule as the daily
 * board, for the same reason: an answer is only interesting next to other
 * people's answers, and that requires everybody to have been asked the same
 * thing.
 *
 * The bank is walked in a shuffled order rather than picked from at random.
 * A random pick repeats within a week often enough to be noticed, and being
 * asked a question you answered on Tuesday is the moment a daily thing stops
 * being worth opening. This way every question is asked exactly once before any
 * is asked twice, and the order is reshuffled each time round so the cycle is
 * not memorised either.
 */

/** Day zero. Any fixed past date works; this one is the week the site opened. */
const EPOCH_DAY = Date.UTC(2026, 8, 1);
const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from the epoch to a YYYY-MM-DD string. Negative before it. */
export function dayIndex(day: string): number {
  return Math.floor((Date.parse(`${day}T00:00:00.000Z`) - EPOCH_DAY) / DAY_MS);
}

/**
 * The order for one lap through the bank.
 *
 * Seeded from the lap number, so lap 3 is the same order on every machine and
 * in every process — the same determinism the games rely on, reused rather
 * than reinvented.
 */
function order(lap: number): PollQuestion[] {
  return shuffle(QUESTIONS, rng(lap * 2654435761 + 1));
}

export function questionFor(day: string = dayOf()): PollQuestion {
  const index = dayIndex(day);
  const size = QUESTIONS.length;
  // Floor division and a non-negative remainder, so a day before the epoch
  // still lands inside the bank rather than off the front of the array.
  const lap = Math.floor(index / size);
  const position = ((index % size) + size) % size;
  return order(lap)[position]!;
}
