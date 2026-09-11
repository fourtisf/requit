/**
 * Is EMAIL_SERVER usable, and if not, exactly why.
 *
 * The previous check was `!== ""`, which is true of every broken value as well
 * as every working one. That is not a pedantic distinction: a connection string
 * assembled by a shell one-liner loses its password far more often than it
 * loses its host — `smtps://user:@host:465` is what you get when the variable
 * holding the password was empty — and the old check called that configured.
 * Sign-in then presented a working form and threw at send time, which is the
 * worst of the three possible states.
 *
 * So the shape is checked here, and the page can say which part is wrong.
 */

export type TransportProblem =
  | "unset"
  | "malformed"
  | "bad-scheme"
  | "no-host"
  | "no-password"
  | "no-user";

const SCHEMES = new Set(["smtp:", "smtps:"]);

export function transportProblem(raw: string): TransportProblem | null {
  const value = raw.trim();
  if (value === "") return "unset";

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return "malformed";
  }

  if (!SCHEMES.has(url.protocol)) return "bad-scheme";
  if (!url.hostname) return "no-host";

  // A server that takes no credentials at all is legitimate — a local relay,
  // or one that authenticates by IP. Half a credential never is.
  const hasUser = url.username !== "";
  const hasPassword = url.password !== "";
  if (hasUser && !hasPassword) return "no-password";
  if (!hasUser && hasPassword) return "no-user";

  return null;
}

/** What an operator is told. Deliberately specific: this is read on a terminal. */
export const PROBLEM_DETAIL: Record<TransportProblem, string> = {
  unset: "EMAIL_SERVER is empty.",
  malformed: "EMAIL_SERVER is not a URL. Expected smtp://user:pass@host:port.",
  "bad-scheme": "EMAIL_SERVER must start with smtp:// or smtps://.",
  "no-host": "EMAIL_SERVER has no hostname.",
  "no-password":
    "EMAIL_SERVER has a username but no password — the password was probably empty when the line was written. Rebuild it and reload.",
  "no-user": "EMAIL_SERVER has a password but no username.",
};

/** For logs and health output: the same string with the credentials removed. */
export function redactTransport(raw: string): string {
  try {
    const url = new URL(raw.trim());
    const user = url.username ? `${decodeURIComponent(url.username)}:***` : "";
    return `${url.protocol}//${user}${user ? "@" : ""}${url.host}`;
  } catch {
    return "(unparseable)";
  }
}
