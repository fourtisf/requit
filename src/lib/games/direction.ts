/**
 * Four directions, shared by the games that take directional input.
 *
 * Merge collapses the board one way and Trail heads one way; the vocabulary is
 * the same, and one parser for it means one place where "is this a direction"
 * is decided for anything a browser submits.
 */
export type Direction = "up" | "down" | "left" | "right";

export const DIRECTIONS: readonly Direction[] = ["up", "down", "left", "right"];

export function isDirection(value: unknown): value is Direction {
  return typeof value === "string" && (DIRECTIONS as readonly string[]).includes(value);
}

/** Where a step in this direction lands, in grid coordinates. */
export const STEP: Record<Direction, { x: number; y: number }> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export function opposite(direction: Direction): Direction {
  return direction === "up"
    ? "down"
    : direction === "down"
      ? "up"
      : direction === "left"
        ? "right"
        : "left";
}
