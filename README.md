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

**Phase 0 — scaffold. Complete.**

| Phase | Scope | State |
|---|---|---|
| 0 | Next.js + Prisma + Redis + Auth.js, CI | ✅ done |
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
| `npm test` | Vitest |
| `npm run db:migrate` | Create and apply a migration |
| `npm run db:seed` | Seed development data (re-runnable) |
| `npm run db:reset` | Drop, re-migrate, re-seed |

CI runs typecheck, lint, tests, a migration + seed pass against a real Postgres,
a schema-drift check, and a production build.

---

## Layout

```
prisma/
  schema.prisma       Data model — HANDOFF.md §3, plus the Auth.js tables
  seed.ts             Development data. No rewards or withdrawals, deliberately.
src/
  auth.ts             Auth.js config — email OTP, database sessions
  app/                App Router pages and route handlers
  components/ui/      Primitives ported from the prototype
  lib/
    brand.ts          The only place the brand name appears
    env.ts            Validated server environment
    prisma.ts         Prisma client singleton
    redis.ts          Redis connection for BullMQ
    queue.ts          One queue per failure domain (HANDOFF.md §2)
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
