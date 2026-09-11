/**
 * Writes EMAIL_SERVER into .env, correctly, and proves it works.
 *
 *   npm run smtp -- team@requit.xyz
 *
 * Host and port default to Hostinger's and are flags, not questions
 * (--host=, --port=). Only the password is ever typed at a prompt, because
 * every question asked is another place for an answer to land in the wrong one.
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
import { addressProblem } from "../src/lib/auth/address";

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

/**
 * Catches a pasted block being eaten by the prompts.
 *
 * This has now happened three times: a multi-line paste answers the first
 * question with its own second line. Nothing in a hostname, a port or an email
 * address contains a space, so a space is the tell — and refusing here is much
 * cheaper than writing a connection string pointing at "pm2 reload requit-web".
 */
function looksPasted(value: string, field: string): boolean {
  if (!/\s/.test(value)) return false;
  console.error(`\n"${value}" is not a ${field}.`);
  console.error("It looks like a pasted command was read as the answer.");
  console.error("Run `npm run smtp` on its own, then type each answer and press Enter.\n");
  return true;
}

async function main(): Promise<void> {
  if (!existsSync(ENV_PATH)) {
    console.error(`No .env at ${ENV_PATH}. Run this from the app directory.`);
    process.exit(1);
  }

  // Host and port are flags, not questions. Three attempts were lost to an
  // answer landing in the wrong prompt, and every question asked is another
  // place for that to happen. Both defaults are right for Hostinger; anyone who
  // needs different ones can pass them.
  const flags = new Map<string, string>();
  for (const arg of process.argv.slice(2)) {
    const match = /^--([a-z]+)=(.+)$/.exec(arg);
    if (match?.[1] && match[2]) flags.set(match[1], match[2]);
  }

  const host = flags.get("host") ?? "smtp.hostinger.com";
  const port = flags.get("port") ?? "465";
  if (!/^[a-zA-Z0-9.-]+$/.test(host)) {
    console.error(`--host="${host}" is not a hostname. Nothing was written.`);
    process.exit(1);
  }
  if (!/^\d{1,5}$/.test(port)) {
    console.error(`--port="${port}" is not a port number. Nothing was written.`);
    process.exit(1);
  }

  // The address may come as a bare argument, leaving the password as the only
  // thing that has to be typed at a prompt.
  const positional = process.argv.slice(2).find((arg) => !arg.startsWith("--"));
  const user = positional ?? (await prompt("Mailbox address: ", false));
  if (!user) {
    console.error("No address given. Nothing was written.");
    process.exit(1);
  }
  if (looksPasted(user, "mailbox address")) process.exit(1);
  if (addressProblem(user)) {
    console.error(`"${user}" is not a mailbox address. Nothing was written.`);
    process.exit(1);
  }

  console.log(`\n  ${user} via ${host}:${port}`);

  const password = await prompt(`  password for ${user}: `, true);
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
