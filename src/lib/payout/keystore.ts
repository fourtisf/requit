import { readFileSync, existsSync } from "node:fs";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { resolve } from "node:path";

/**
 * The hot wallet's key, encrypted at rest.
 *
 * §6.3: "Do not put production private keys in a plaintext .env on the VPS.
 * Minimum acceptable: keys encrypted at rest, decrypted into memory at process
 * start using a passphrase supplied out-of-band (not in the repo, not in the
 * deploy script)."
 *
 * An encrypted file whose passphrase sits next to it in .env is the same file
 * in two pieces — anyone who can read one can read the other. So the passphrase
 * being absent from .env is not advice here, it is checked: see
 * assertPassphraseNotOnDisk(). The worker refuses to start otherwise, because a
 * rule about key custody that is only written in a comment is not a rule.
 */

const KDF = { N: 2 ** 17, r: 8, p: 1, keyLength: 32 } as const;
const VERSION = 1;

export type Keystore = {
  version: number;
  kdf: "scrypt";
  n: number;
  r: number;
  p: number;
  salt: string;
  iv: string;
  tag: string;
  ciphertext: string;
};

export class KeystoreError extends Error {
  override name = "KeystoreError";
}

export function encryptSecret(secret: string, passphrase: string): Keystore {
  if (passphrase.length < 16) {
    throw new KeystoreError("Passphrase must be at least 16 characters.");
  }

  const salt = randomBytes(32);
  const key = scryptSync(passphrase, salt, KDF.keyLength, {
    N: KDF.N,
    r: KDF.r,
    p: KDF.p,
    maxmem: 512 * 1024 * 1024,
  });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);

  return {
    version: VERSION,
    kdf: "scrypt",
    n: KDF.N,
    r: KDF.r,
    p: KDF.p,
    salt: salt.toString("base64"),
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    ciphertext: ciphertext.toString("base64"),
  };
}

export function decryptSecret(store: Keystore, passphrase: string): string {
  if (store.version !== VERSION) {
    throw new KeystoreError(`Unsupported keystore version ${store.version}.`);
  }

  const key = scryptSync(passphrase, Buffer.from(store.salt, "base64"), KDF.keyLength, {
    N: store.n,
    r: store.r,
    p: store.p,
    maxmem: 512 * 1024 * 1024,
  });

  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(store.iv, "base64"));
  decipher.setAuthTag(Buffer.from(store.tag, "base64"));

  try {
    // GCM authenticates, so a wrong passphrase fails here rather than returning
    // plausible-looking garbage that we would then try to sign with.
    return Buffer.concat([
      decipher.update(Buffer.from(store.ciphertext, "base64")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new KeystoreError("Wrong passphrase, or the keystore has been tampered with.");
  }
}

/**
 * Refuses to continue if the passphrase is sitting in the .env file.
 *
 * This is the whole point of §6.3 made enforceable. The check is on the FILE,
 * not on process.env: the passphrase is supposed to be in process.env — that is
 * how it gets in — and is supposed not to be on disk.
 */
export function assertPassphraseNotOnDisk(
  passphrase: string,
  envPath = resolve(process.cwd(), ".env"),
): void {
  if (!existsSync(envPath)) return;

  let contents: string;
  try {
    contents = readFileSync(envPath, "utf8");
  } catch {
    // Unreadable .env is not evidence of a leak; do not block the payout
    // worker over a permissions quirk.
    return;
  }

  for (const line of contents.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) continue;

    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;

    const name = trimmed.slice(0, eq).trim();
    if (name !== "HOT_WALLET_PASSPHRASE") continue;

    // An empty placeholder is what .env.example carries, and is fine.
    const value = parseEnvValue(trimmed.slice(eq + 1));
    if (value === "") continue;

    // Compare against the live passphrase so that an unrelated leftover line
    // is reported just as firmly — either way there is a passphrase on disk.
    const matches =
      value.length === passphrase.length &&
      timingSafeEqual(Buffer.from(value), Buffer.from(passphrase));

    throw new KeystoreError(
      matches
        ? "HOT_WALLET_PASSPHRASE is in .env on this machine. §6.3 forbids it: the keystore and its passphrase in one place is a plaintext key. Remove the line and inject it at process start instead."
        : "HOT_WALLET_PASSPHRASE has a value in .env, even though a different one is in the environment. Remove the line — a passphrase on disk is a passphrase on disk.",
    );
  }
}

/**
 * The value half of one .env line, as dotenv would read it.
 *
 * Trailing comments have to be handled, and handled in the right order: a real
 * `.env` writes `HOT_WALLET_PASSPHRASE=""  # supplied at process start`, and
 * naively taking everything after `=` reads that comment as the passphrase.
 * The worker would then refuse to start on a machine that is configured
 * exactly right — a false alarm, which is how a safety check gets switched off.
 *
 * A quoted value is read to its closing quote first, because `#` is a perfectly
 * ordinary character inside a passphrase and must not truncate it.
 */
function parseEnvValue(raw: string): string {
  const value = raw.trim();
  const quote = value[0];

  if (quote === '"' || quote === "'") {
    const end = value.indexOf(quote, 1);
    // An unterminated quote is malformed; treat the rest as the value rather
    // than silently reading half of it.
    return end === -1 ? value.slice(1) : value.slice(1, end);
  }

  const comment = value.indexOf("#");
  return (comment === -1 ? value : value.slice(0, comment)).trim();
}

export type LoadedKey = { secret: string };

/**
 * Reads the keystore and unlocks it. Called once, at worker start.
 *
 * Returns the material rather than caching it in a module global: the caller
 * builds its signer and holds that, so there is one place in the process that
 * has ever seen the raw key.
 */
export function loadHotWalletSecret(options: {
  keystorePath: string;
  passphrase: string;
}): LoadedKey {
  if (!options.passphrase) {
    throw new KeystoreError(
      "HOT_WALLET_PASSPHRASE is not set. Inject it at process start; it must not be stored on this machine.",
    );
  }

  assertPassphraseNotOnDisk(options.passphrase);

  if (!existsSync(options.keystorePath)) {
    throw new KeystoreError(`No keystore at ${options.keystorePath}.`);
  }

  let parsed: Keystore;
  try {
    parsed = JSON.parse(readFileSync(options.keystorePath, "utf8")) as Keystore;
  } catch {
    throw new KeystoreError(`Keystore at ${options.keystorePath} is not readable JSON.`);
  }

  return { secret: decryptSecret(parsed, options.passphrase) };
}
