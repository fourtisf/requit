/**
 * Inline SVG rather than an icon font or a CDN sprite.
 *
 * The CSP has no external image or font source, and two icons do not justify
 * loosening it. `currentColor` throughout so they inherit whatever the row
 * around them is doing.
 */
export function SocialIcon({ name, size = 15 }: { name: "x" | "telegram"; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "currentColor",
    "aria-hidden": true as const,
    className: "shrink-0",
  };

  if (name === "x") {
    return (
      <svg {...shared}>
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M21.94 4.9 18.63 20.5c-.25 1.1-.9 1.37-1.82.85l-5.03-3.7-2.43 2.33c-.27.27-.5.5-1.02.5l.36-5.13L17.99 7.4c.4-.36-.09-.56-.63-.2L6.8 13.63l-4.96-1.55c-1.08-.34-1.1-1.08.22-1.6L20.55 3.3c.9-.33 1.69.2 1.39 1.6z" />
    </svg>
  );
}
