# Requit

Advertiser-funded task platform with a revenue-share token layer.

> **The name is a placeholder.** `Requit` lives in exactly one place —
> [`src/lib/brand.ts`](src/lib/brand.ts) — and a test fails the build if it is
> hardcoded anywhere else. Renaming is one edit.

Two documents govern this repository:

| Document | Authority |
|---|---|
| [`docs/HANDOFF.md`](docs/HANDOFF.md) | Technical source of truth — data model, integration rules, build phases |
| [`docs/prototype/requit.html`](docs/prototype/requit.html) | Design source of truth — the single-file prototype |

Where they disagree, ask. Do not pick one.

---

## Status

**Phase 0 — scaffold. Complete, plus a hardening pass.**

| Phase | Scope | State |
|---|---|---|
| 0 | Next.js + Prisma + Redis + Auth.js, CI | ✅ done |
| 0.1 | Hardening: route gate, CSP, suspension, health, alerting, DB tests | ✅ done |
| 1 | Offer ingestion and postbacks (staging only) | not started |
| — | **Gate: ALFA approves staging before Phase 2** | |
| 2 | Wallets and withdrawals | not started |
| 3 | Disputes, admin, treasury | not started |
| 4 | Public proof pages | not started |
| 5 | Vault and distributions | **legally gated — do not start** |

Phase 5 must not be built, and its models must not be migrated, until ALFA
confirms in writing that a lawyer has reviewed it (HANDOFF.md §0.2).

---

## Running it locally

Requires Node 22 and Docker.

```bash
cp .env.example .env
# AUTH_SECRET must be set — anything for local use:
#   openssl rand -base64 32

docker compose up -d          # Postgres 16 + Redis 7
npm install
npm run db:migrate            # applies migrations
npm run db:seed               # 5 users, 30 offers, tier rows on the games

npm run dev                   # http://localhost:3000
npm run worker                # separate terminal — BullMQ processors
```

### Signing in

There is no password. `/signin` emails a six-digit code.

With `EMAIL_SERVER` empty — the default in `.env.example` — no mail is sent and
the code is printed to the dev server log instead:

```
  [auth] sign-in code for you@example.com: 607352
```

`serverEnv()` refuses to boot in production with `EMAIL_SERVER` unset, so this
shortcut cannot escape development.

---

## Commands

| Command | Does |
|---|---|
| `npm run dev` | Next dev server |
| `npm run worker` | BullMQ worker process |
| `npm run build` | Production build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |
| `npm test` | Unit tests. No database, runs in under a second. |
| `npm run test:db` | Integration tests. Needs `TEST_DATABASE_URL`. |
| `npm run test:all` | Both suites. |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Seed development data (re-runnable) |
| `npm run db:reset` | Drop, re-migrate, re-seed |

> `TEST_DATABASE_URL` must point at a throwaway database. The integration suite
> truncates every table on every run, and refuses to start if the variable is unset.

CI runs typecheck, lint, unit tests, a migration + seed pass against a real
Postgres, the integration suite, a schema-drift check, and a production build.

---

## Security posture

Phase 0 has no money in it, but the surfaces that will carry money are built now
and are cheaper to get right before there are more pages.

| Control | Where | Why |
|---|---|---|
| Route gate | `src/middleware.ts` | Coarse cookie check on `/dashboard` and friends, so a page added later that forgets `requireUser()` is still not served to anonymous visitors. |
| Authoritative gate | `requireUser()` in `src/lib/session.ts` | Middleware runs on the edge and cannot reach the database. Suspension is decided here. |
| CSP with per-request nonce | `src/middleware.ts` | Next inlines bootstrap scripts, so a nonce-less policy means `'unsafe-inline'`, which is not a policy. `frame-ancestors 'none'` — a withdrawal screen inside someone else's iframe is a clickjacked payout. |
| HSTS, nosniff, Referrer-Policy, Permissions-Policy | `next.config.ts` | Static headers, set once. |
| Indexing opt-in | `NEXT_PUBLIC_ALLOW_INDEXING` | Staging cannot be indexed by omission. |
| Sign-in rate limits | `src/auth.ts` | 5 codes per address / 15 min, and 20 per source IP / hour. The per-address limit alone is bypassed by rotating the address, which costs the attacker nothing and costs us an email each time. |
| Session payload allowlist | `src/lib/auth/session-payload.ts` | `/api/auth/session` is browser-readable. Spreading the adapter row would publish `sessionToken`. Tested. |
| Suspension with appeal | `/suspended` | §7: never ban silently. |

**Two behaviours that are deliberate and will look like bugs if you do not know:**

- **Sign-in fails closed when Redis is down.** The limiter throws, and no code is
  sent. The alternative is that a Redis outage silently removes every limit on an
  endpoint that sends email and hands out credentials.
- **Redis has two connections.** `redis()` is BullMQ's and must keep
  `maxRetriesPerRequest: null`; that setting makes commands *queue* during an
  outage instead of failing, which on a request path is an indefinite hang.
  `kv()` is the request-path connection and fails within about a second.
  Anything serving an HTTP request uses `kv()`.

---

## Operations

- `GET /api/health` — checks Postgres and Redis, returns 503 when either is down,
  and is bounded to ~2s per check so a probe can never hang.
- **Sentry** is wired through `instrumentation.ts` and is a no-op without
  `SENTRY_DSN`. Cookies, auth headers and query strings are stripped before send:
  sign-in codes and wallet addresses travel in query strings.
- **Telegram alerts** via `alert()` in `src/lib/alert.ts`, no-op without a bot
  token, and never throws into its caller — a payout worker that dies because
  Telegram is unreachable is worse than a missed alert.
- The worker only alerts once a job has burned its retries. From Phase 2 this
  channel carries payout failures, and a channel ALFA has learned to ignore is
  worse than no channel.

`AUTH_URL` is **required in production**. Auth.js runs with `trustHost` because it
sits behind Cloudflare and Nginx; without `AUTH_URL` the Host header decides the
sign-in origin. `serverEnv()` refuses to boot without it.

---

## Layout

```
prisma/
  schema.prisma       Data model — HANDOFF.md §3, plus the Auth.js tables.
                      Every deviation from §3 is listed at the top of the file.
  seed.ts             Development data. No rewards or withdrawals, deliberately.
instrumentation.ts    Sentry boot hook
src/
  auth.ts             Auth.js config — email OTP, database sessions
  middleware.ts       Route gate + per-request CSP nonce
  app/                App Router pages and route handlers
  components/ui/      Primitives ported from the prototype
  lib/
    brand.ts          The only place the brand name appears
    env.ts            Validated server environment
    session.ts        requireUser() — the gate every signed-in page calls
    prisma.ts         Prisma client singleton
    redis.ts          Two connections: redis() for BullMQ, kv() for requests
    queue.ts          One queue per failure domain (HANDOFF.md §2)
    rate-limit.ts     Fixed-window limiter. Fails closed.
    alert.ts          Telegram alerting. Never throws into its caller.
    auth/
      session-payload.ts  What /api/auth/session is allowed to publish
  test/               Test harness — unit env fixture, DB reset helper
  worker/             Background worker entrypoint
docs/                 Handoff and prototype
```

---

## Three things that will kill this project

Read HANDOFF.md §0 in full. In short:

1. **The brand name is a placeholder.** Enforced by a test.
2. **The token layer is legally gated.** Phases 0–4 are a complete business
   without it. If legal comes back negative, they still ship.
3. **The float will break you before the code does.** Networks pay on NET-15 to
   NET-30; users withdraw from $10 within hours. The company fronts every payout
   for two to four weeks. The Phase 3 treasury dashboard is the instrument that
   says when to slow down.

## Conventions that are not negotiable

- **No figure on a public page is a literal.** Every number traces to a query.
  If it cannot be computed yet, return `null` and hide the row — the `Stat`
  primitive renders an em dash rather than inventing a zero.
- **Completion rates are derived**, never stored: `completions / starts`, hidden
  below 30 samples (HANDOFF.md §4.4).
- **`Offer.advertiserPays` never leaves the server.** It is not in any public
  API response.
- **Unique constraints are load-bearing.** `(network, networkTxnId)` is the
  postback dedupe. `(chain, address)` is the anti-multi-account guard.
  `Withdrawal.idempotencyKey` is what stops a double-clicked button from
  draining the hot wallet. None of them are hints.
