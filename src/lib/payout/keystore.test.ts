import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  assertPassphraseNotOnDisk,
  decryptSecret,
  encryptSecret,
  KeystoreError,
  loadHotWalletSecret,
} from "@/lib/payout/keystore";

const PASSPHRASE = "a-long-enough-passphrase";
const SECRET = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d";

function envFile(contents: string): string {
  const dir = mkdtempSync(join(tmpdir(), "requit-keystore-"));
  const path = join(dir, ".env");
  writeFileSync(path, contents);
  return path;
}

describe("encryption", () => {
  it("round-trips the key", () => {
    const store = encryptSecret(SECRET, PASSPHRASE);
    expect(decryptSecret(store, PASSPHRASE)).toBe(SECRET);
  });

  it("never writes the key in the clear", () => {
    const store = encryptSecret(SECRET, PASSPHRASE);
    const serialised = JSON.stringify(store);
    expect(serialised).not.toContain(SECRET);
    expect(serialised).not.toContain(SECRET.slice(2, 20));
    expect(serialised).not.toContain(PASSPHRASE);
  });

  it("produces different bytes each time for the same key", () => {
    // A fresh salt and IV per encryption, so two keystores for the same wallet
    // do not reveal that they hold the same key.
    const a = encryptSecret(SECRET, PASSPHRASE);
    const b = encryptSecret(SECRET, PASSPHRASE);
    expect(a.ciphertext).not.toBe(b.ciphertext);
    expect(a.salt).not.toBe(b.salt);
  });

  it("refuses a wrong passphrase rather than returning garbage", () => {
    const store = encryptSecret(SECRET, PASSPHRASE);
    expect(() => decryptSecret(store, `${PASSPHRASE}x`)).toThrow(KeystoreError);
  });

  it("refuses a tampered ciphertext", () => {
    // GCM authenticates. Without that, a flipped byte would decrypt to a
    // different key and we would sign a payout with it.
    const store = encryptSecret(SECRET, PASSPHRASE);
    const bytes = Buffer.from(store.ciphertext, "base64");
    bytes.writeUInt8(bytes.readUInt8(0) ^ 0xff, 0);
    expect(() =>
      decryptSecret({ ...store, ciphertext: bytes.toString("base64") }, PASSPHRASE),
    ).toThrow(KeystoreError);
  });

  it("refuses a tampered auth tag or salt", () => {
    const store = encryptSecret(SECRET, PASSPHRASE);
    const tag = Buffer.from(store.tag, "base64");
    tag.writeUInt8(tag.readUInt8(0) ^ 0xff, 0);
    expect(() => decryptSecret({ ...store, tag: tag.toString("base64") }, PASSPHRASE)).toThrow(
      KeystoreError,
    );

    const salt = Buffer.from(store.salt, "base64");
    salt.writeUInt8(salt.readUInt8(0) ^ 0xff, 0);
    expect(() => decryptSecret({ ...store, salt: salt.toString("base64") }, PASSPHRASE)).toThrow(
      KeystoreError,
    );
  });

  it("refuses a passphrase short enough to grind", () => {
    expect(() => encryptSecret(SECRET, "short")).toThrow(KeystoreError);
  });
});

describe("§6.3: the passphrase must not be on disk", () => {
  it("refuses when .env carries the same passphrase", () => {
    const path = envFile(`DATABASE_URL="x"\nHOT_WALLET_PASSPHRASE="${PASSPHRASE}"\n`);
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path)).toThrow(/6\.3|forbids/);
  });

  it("refuses even when .env carries a different passphrase", () => {
    // A stale line is still a passphrase on disk next to the keystore.
    const path = envFile(`HOT_WALLET_PASSPHRASE=an-old-passphrase-value\n`);
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path)).toThrow(KeystoreError);
  });

  it("allows the empty placeholder that .env.example ships", () => {
    for (const line of ['HOT_WALLET_PASSPHRASE=""', "HOT_WALLET_PASSPHRASE=", "HOT_WALLET_PASSPHRASE=''"]) {
      const path = envFile(`${line}\n`);
      expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path), line).not.toThrow();
    }
  });

  it("reads a quoted value without swallowing the trailing comment", () => {
    // This is the exact line a correctly configured .env carries. Reading the
    // comment as the value would block the worker on a machine that is set up
    // right, and a safety check that cries wolf gets switched off.
    const path = envFile('HOT_WALLET_PASSPHRASE=""     # supplied at process start\n');
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path)).not.toThrow();
  });

  it("does not let a # inside a passphrase truncate it", () => {
    const hashy = "pass#phrase#with#hashes";
    const path = envFile(`HOT_WALLET_PASSPHRASE="${hashy}"\n`);
    expect(() => assertPassphraseNotOnDisk(hashy, path)).toThrow(/6\.3|forbids/);
  });

  it("ignores a commented-out line", () => {
    const path = envFile(`# HOT_WALLET_PASSPHRASE="${PASSPHRASE}"\n`);
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path)).not.toThrow();
  });

  it("is not fooled by a variable that merely starts the same", () => {
    const path = envFile(`HOT_WALLET_PASSPHRASE_HINT="in 1password"\n`);
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, path)).not.toThrow();
  });

  it("allows a machine with no .env at all", () => {
    expect(() => assertPassphraseNotOnDisk(PASSPHRASE, "/nonexistent/.env")).not.toThrow();
  });
});

describe("loading", () => {
  it("refuses to run with no passphrase in the environment", () => {
    expect(() =>
      loadHotWalletSecret({ keystorePath: "/nonexistent.json", passphrase: "" }),
    ).toThrow(/not set/);
  });

  it("reports a missing keystore clearly", () => {
    expect(() =>
      loadHotWalletSecret({ keystorePath: "/nonexistent.json", passphrase: PASSPHRASE }),
    ).toThrow(/No keystore/);
  });

  it("unlocks a real keystore file", () => {
    const dir = mkdtempSync(join(tmpdir(), "requit-keystore-"));
    const path = join(dir, "hot.json");
    writeFileSync(path, JSON.stringify(encryptSecret(SECRET, PASSPHRASE)));

    // cwd here has no HOT_WALLET_PASSPHRASE with a value, so the disk check passes.
    const loaded = loadHotWalletSecret({ keystorePath: path, passphrase: PASSPHRASE });
    expect(loaded.secret).toBe(SECRET);
  });
});
