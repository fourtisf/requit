/**
 * Rewrites one key in a .env file, leaving every other byte alone.
 *
 * Lives here rather than inside the script that uses it because it edits the
 * file that decides whether the site boots. "It is only a few lines" is what I
 * said about the last .env parser in this codebase, which then had a bug that
 * would have blocked the payout worker on a correctly configured machine.
 */
export function setEnvKey(contents: string, key: string, value: string): string {
  const line = `${key}="${value}"`;
  let replaced = false;

  const next = contents.split("\n").map((raw) => {
    const trimmed = raw.trim();
    // A commented-out line stays commented out. Replacing it would silently
    // re-enable a setting someone deliberately turned off.
    if (trimmed.startsWith("#")) return raw;

    const eq = trimmed.indexOf("=");
    if (eq === -1 || trimmed.slice(0, eq).trim() !== key) return raw;

    replaced = true;
    return line;
  });

  if (!replaced) next.push(line);
  return next.join("\n");
}
