/**
 * Writes EMAIL_SERVER into .env, correctly, and proves it works.
 *
 *   npm run smtp
 *
 * This exists because the shell one-liner it replaces kept failing in the same
 * way: `read -rsp ... P` consumes the NEXT LINE of a pasted block as the
 * password, so the variable ends up holding a fragment of the script and the
 * connection string is written with no password at all. The result looked like
 * success — the line was in .env, sign-in showed a form — and failed only when
 * someone actually tried to log in.
 *
 * A script owns its own prompt, so there is no paste to go wrong.
 */
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";
import { createTransport } from "nodemailer";
import { transportProblem, PROBLEM_DETAIL, redactTransport } from "../src/lib/auth/transport";
import { BRAND } from "../src/lib/brand";
import { setEnvKey } from "../src/lib/env-file";

const ENV_PATH = resolve(process.cwd(), ".env");

async function prompt(question: string, hidden: boolean): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  if (!hidden) {
    const answer = await new Promise<string>((done) => rl.question(question, done));
    rl.close();
    return answer.trim();
  }

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
  if (!existsSync(ENV_PATH)) {
    console.error(`No .env at ${ENV_PATH}. Run this from the app directory.`);
    process.exit(1);
  }

  const host = (await prompt("SMTP host [smtp.hostinger.com]: ", false)) || "smtp.hostinger.com";
  const port = (await prompt("Port [465]: ", false)) || "465";
  const user = await prompt("Mailbox address: ", false);
  if (!user) {
    console.error("No address given. Nothing was written.");
    process.exit(1);
  }

  const password = await prompt("Mailbox password: ", true);
  if (!password) {
    // The exact failure this script exists to prevent.
    console.error("No password entered. Nothing was written.");
    process.exit(1);
  }
  console.log(`  read ${password.length} characters.`);

  // encodeURIComponent, not a hand-rolled escape: an @ or : in either half
  // silently breaks the URL, and a password is exactly where those appear.
  const scheme = port === "465" ? "smtps" : "smtp";
  const server =
    `${scheme}://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:${port}`;

  const problem = transportProblem(server);
  if (problem) {
    console.error(`Refusing to write: ${PROBLEM_DETAIL[problem]}`);
    process.exit(1);
  }

  console.log(`\nTesting ${redactTransport(server)} …`);
  try {
    const transport = createTransport(server);
    await transport.verify();
    transport.close();
    console.log("  connected and authenticated.");
  } catch (error) {
    // Written only after it is proven to work. A broken value in .env is worse
    // than none: sign-in then shows a working form and fails on send.
    console.error(`  failed: ${error instanceof Error ? error.message : "unknown"}`);
    console.error("\nNothing was written. Common causes:");
    console.error("  - wrong password");
    console.error("  - port 465 blocked by the host; try 587");
    console.error("  - the mailbox does not exist yet");
    process.exit(1);
  }

  copyFileSync(ENV_PATH, `${ENV_PATH}.bak`);
  let contents = readFileSync(ENV_PATH, "utf8");
  contents = setEnvKey(contents, "EMAIL_SERVER", server);
  contents = setEnvKey(contents, "EMAIL_FROM", `${BRAND.name} <${user}>`);
  writeFileSync(ENV_PATH, contents, { mode: 0o600 });

  console.log(`\nWrote .env (previous copy at .env.bak).`);
  console.log("Now reload so the app picks it up:\n");
  console.log("  pm2 reload requit-web");
  console.log("\nThen check:\n");
  console.log(`  curl -s localhost:3001/api/health | grep -o '"name":"mail","ok":[a-z]*'`);
}

void main();
