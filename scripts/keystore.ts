/**
 * Creates an encrypted hot-wallet keystore. §6.3.
 *
 *   npm run keystore -- /var/lib/requit/base.json
 *
 * Both the key and the passphrase are read from the terminal, never from
 * arguments or environment: an argument lands in shell history and in `ps` for
 * every user on the box, which would defeat the entire point of encrypting the
 * file it produces.
 *
 * Run it on a machine you trust. The plaintext key exists in this process's
 * memory for as long as it takes to encrypt, and nowhere else.
 */
import "dotenv/config";
import { createInterface } from "node:readline";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { encryptSecret } from "../src/lib/payout/keystore";

async function prompt(question: string, hidden: boolean): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  if (!hidden) {
    const answer = await new Promise<string>((done) => rl.question(question, done));
    rl.close();
    return answer.trim();
  }

  // Suppress the echo so the key is not left on screen, or in a scrollback
  // buffer that gets pasted into a chat window later. readline writes through
  // an internal hook, so replacing that hook is what actually mutes it.
  let muted = false;
  const internal = rl as unknown as { _writeToOutput: (text: string) => void };
  internal._writeToOutput = (text: string) => {
    process.stdout.write(muted ? "*" : text);
  };

  process.stdout.write(question);
  muted = true;

  const answer = await new Promise<string>((done) => rl.question("", done));
  rl.close();
  process.stdout.write("\n");
  return answer.trim();
}

async function main(): Promise<void> {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: npm run keystore -- <path-to-write>");
    process.exit(1);
  }

  const path = resolve(target);
  if (existsSync(path)) {
    console.error(`${path} already exists. Refusing to overwrite a keystore.`);
    process.exit(1);
  }

  const secret = await prompt("Private key (hex for Base, base58 for Solana): ", true);
  if (!secret) {
    console.error("Nothing entered.");
    process.exit(1);
  }

  const passphrase = await prompt("Passphrase (16+ characters): ", true);
  const again = await prompt("Passphrase again: ", true);

  if (passphrase !== again) {
    console.error("The two passphrases differ. Nothing was written.");
    process.exit(1);
  }

  let store;
  try {
    store = encryptSecret(secret, passphrase);
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Could not encrypt.");
    process.exit(1);
  }

  mkdirSync(dirname(path), { recursive: true });
  // 0600: readable only by the user the worker runs as.
  writeFileSync(path, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });

  console.log(`\nWrote ${path}`);
  console.log("\nNow, in order:");
  console.log("  1. Store the passphrase somewhere that is NOT this machine.");
  console.log("  2. Make sure HOT_WALLET_PASSPHRASE has no value in .env — the");
  console.log("     worker checks, and refuses to start if it finds one.");
  console.log("  3. Start the worker with the passphrase injected:");
  console.log("       read -rs HOT_WALLET_PASSPHRASE && export HOT_WALLET_PASSPHRASE \\");
  console.log("         && pm2 restart requit-worker --update-env");
  console.log("\n  The passphrase lives only in the worker process. A reboot needs");
  console.log("  a person, which is the trade §6.3 asks for.");
}

void main();
