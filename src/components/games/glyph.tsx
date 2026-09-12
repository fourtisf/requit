/**
 * Eight shapes, drawn rather than typed.
 *
 * Flood and Recall both need a small set of marks a player can tell apart at a
 * glance. Unicode symbols would have been one line each and a lottery — several
 * of the obvious ones are missing from the default font on some Androids, and a
 * game of "match the empty box" is not a game. These are paths, so they render
 * the same everywhere and scale to any tile size.
 *
 * In Flood they are also the accessibility answer: a board told apart by colour
 * alone is unplayable for about one man in twelve, and a shape on every tile
 * costs nothing.
 */

const SHAPES = [
  { name: "circle", path: <circle cx="12" cy="12" r="7.5" /> },
  { name: "square", path: <rect x="4.8" y="4.8" width="14.4" height="14.4" rx="2.4" /> },
  { name: "triangle", path: <path d="M12 3.6 20.4 19.2H3.6Z" /> },
  { name: "diamond", path: <path d="M12 2.8 21.2 12 12 21.2 2.8 12Z" /> },
  {
    name: "star",
    path: <path d="m12 2.9 2.7 6 6.5.7-4.9 4.4 1.4 6.4L12 17.1l-5.7 3.3 1.4-6.4L2.8 9.6l6.5-.7z" />,
  },
  { name: "cross", path: <path d="M9.8 3.6h4.4v6.2h6.2v4.4h-6.2v6.2H9.8v-6.2H3.6V9.8h6.2z" /> },
  { name: "hexagon", path: <path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z" /> },
  {
    name: "ring",
    path: (
      <path
        fillRule="evenodd"
        d="M12 3.6a8.4 8.4 0 1 0 0 16.8 8.4 8.4 0 0 0 0-16.8Zm0 4.6a3.8 3.8 0 1 1 0 7.6 3.8 3.8 0 0 1 0-7.6Z"
      />
    ),
  },
] as const;

export const GLYPH_COUNT = SHAPES.length;

/** The shape's name, for anything that has to be said out loud. */
export function glyphName(shape: number): string {
  return SHAPES[shape % GLYPH_COUNT]!.name;
}

export function Glyph({ shape, className }: { shape: number; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className={className}>
      {SHAPES[shape % GLYPH_COUNT]!.path}
    </svg>
  );
}
