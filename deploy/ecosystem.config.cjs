/**
 * PM2 process definitions for the VPS (HANDOFF.md §1).
 *
 * Two processes, not one. §2 keeps the subsystems in separate failure domains,
 * and that only means anything if a wedged payout worker cannot take the web
 * process — and therefore the postback endpoint — down with it.
 *
 * NO SECRETS IN THIS FILE. It is committed. Both processes read .env from the
 * app directory (Next loads it; the worker loads it via dotenv). §6.3 is
 * explicit that the hot wallet passphrase is supplied out of band and never
 * lands in the repo or the deploy script.
 */
const { existsSync, readFileSync } = require("node:fs");
const { join } = require("node:path");

const APP_DIR = "/var/www/requit";

/**
 * The port, read from .env by this file rather than inherited from whoever ran
 * pm2.
 *
 * It used to be `process.env.PORT || "3000"`, which worked through deploy.sh —
 * that sources .env first — and failed through everything else. `pm2 restart
 * --update-env` from a login shell re-evaluates this file with no PORT set, so
 * the app silently moved from 3001 to 3000 while Caddy went on proxying to
 * 3001. Every process reported healthy and the site was down.
 *
 * A port that depends on the ambient environment is a port that changes when
 * nobody meant to change it. This reads the same file the app reads.
 */
function portFromEnvFile() {
  const path = join(APP_DIR, ".env");
  if (!existsSync(path)) return null;

  // Last wins, the way dotenv resolves a duplicated key.
  let value = null;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const match = /^\s*PORT\s*=\s*(.*)$/.exec(line);
    if (!match) continue;
    let raw = (match[1] || "").trim();
    // A quoted value ends at its closing quote; an unquoted one ends at a #.
    if (raw.startsWith('"') || raw.startsWith("'")) {
      const quote = raw[0];
      const end = raw.indexOf(quote, 1);
      raw = end === -1 ? raw.slice(1) : raw.slice(1, end);
    } else {
      raw = raw.split("#")[0].trim();
    }
    if (/^\d{1,5}$/.test(raw)) value = raw;
  }
  return value;
}

// .env first, then the environment, then Next's own default. Change the
// upstream in the Caddyfile to match if you move it.
const PORT = portFromEnvFile() || process.env.PORT || "3000";

module.exports = {
  apps: [
    {
      name: "requit-web",
      cwd: APP_DIR,
      script: "node_modules/next/dist/bin/next",
      args: `start -p ${PORT}`,
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production", PORT },
      max_memory_restart: "600M",
      // Next serves traffic within a second or two; anything longer is a real
      // failure, not a slow boot.
      listen_timeout: 10000,
      kill_timeout: 5000,
      error_file: "/var/log/requit/web.error.log",
      out_file: "/var/log/requit/web.out.log",
      merge_logs: true,
      time: true,
    },
    {
      name: "requit-worker",
      cwd: APP_DIR,
      script: "node_modules/.bin/tsx",
      args: "src/worker/index.ts",
      instances: 1,
      exec_mode: "fork",
      env: { NODE_ENV: "production" },
      max_memory_restart: "600M",
      // The worker drains in-flight jobs on SIGTERM. From Phase 2 an in-flight
      // job may have broadcast a transaction, so cutting it short turns a
      // restart into a reconciliation problem. Give it room to finish.
      kill_timeout: 30000,
      error_file: "/var/log/requit/worker.error.log",
      out_file: "/var/log/requit/worker.out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
