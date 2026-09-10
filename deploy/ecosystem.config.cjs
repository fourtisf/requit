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
// Set PORT in .env if 3000 is taken. deploy.sh sources .env before reloading,
// so PM2 inherits it — but remember to change the upstream in nginx.conf too.
const PORT = process.env.PORT || "3000";

module.exports = {
  apps: [
    {
      name: "requit-web",
      cwd: "/var/www/requit",
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
      cwd: "/var/www/requit",
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
