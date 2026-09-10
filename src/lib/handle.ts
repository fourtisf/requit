/**
 * Handles are public: they appear on the proof table (HANDOFF.md §8) for any user
 * who has not turned `publicPayouts` off. So they are derived from the email but
 * must never be reversible into one — the domain is dropped and anything that is
 * not a safe character goes away.
 */
const MIN_LENGTH = 3;
const MAX_LENGTH = 20;

export function normaliseHandle(raw: string): string {
  const cleaned = raw
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, MAX_LENGTH);

  return cleaned;
}

/** The candidate handle for an email address, before uniqueness is applied. */
export function handleSeedFromEmail(email: string): string {
  const localPart = email.split("@")[0] ?? "";
  const candidate = normaliseHandle(localPart);
  return candidate.length >= MIN_LENGTH ? candidate : "member";
}

/**
 * Appends a numeric suffix until `isTaken` says the handle is free. The suffix is
 * counted, not random, so a user's handle stays short and readable.
 */
export async function allocateHandle(
  email: string,
  isTaken: (handle: string) => Promise<boolean>,
): Promise<string> {
  const seed = handleSeedFromEmail(email);

  if (!(await isTaken(seed))) return seed;

  for (let suffix = 2; suffix < 10_000; suffix += 1) {
    const tail = `_${suffix}`;
    const candidate = `${seed.slice(0, MAX_LENGTH - tail.length)}${tail}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  throw new Error(`Could not allocate a handle for seed "${seed}"`);
}
