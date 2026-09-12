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
| 0.2 | Member surfaces: settings, referral, notifications, leaderboard, statement | ✅ done |
| 0.3 | Public site (non-numeric sections) and the three policy pages | ✅ done |
| 1 | Offer ingestion and postbacks (staging only) | not started |
| — | **Gate: ALFA approves staging before Phase 2** | |
| 2 | Wallets and withdrawals | not started |
| 3 | Disputes, admin, treasury | not started |
| 4 | Public proof pages — the numeric half | not started |
| 5 | Vault and distributions | **legally gated — do not start** |

Phase 5 must not be built, and its models must not be migrated, until ALFA
confirms in writing that a lawyer has reviewed it (HANDOFF.md §0.2).

---

## Deploying

`deploy/` holds the VPS setup — PM2, Nginx, and a deploy script that migrates
before it builds and builds before it reloads, so a broken build never replaces a
working site. Full walkthrough in [`deploy/README.md`](deploy/README.md).

```bash
cd /var/www/requit && ./deploy/deploy.sh
```

> **Country detection needs Cloudflare in front.** `src/lib/country.ts` reads
> `cf-ipcountry`, which only exists when the domain is proxied through
> Cloudflare. Pointed straight at the box, every signup records `XX` — and
> offers are matched by country, so nobody is eligible for anything. Step 6 of
> the deploy guide. Do it before Phase 1.

---

## Brand assets

Fourteen logo candidates live in [`docs/brand/`](docs/brand/) as SVG, in two
sets: **Line** (built from strokes) and **Mass** (built from solid form and
negative space). `preview.html` shows each at 88px, as a lockup, at 19px — the
nav size, where marks fall apart — and on a light background, which is what
decides whether it can go on an invoice.

The SVG files are the source of truth. Edit one and rebuild the sheet:

```bash
python3 docs/brand/build.py
```

**Flow is the chosen mark** and is live: `<BrandMark />` and `<BrandLockup />`
in `src/components/ui/brand-mark.tsx`, plus `src/app/icon.svg` for the favicon.
It is defined once, the same way the name is — before this it was pasted into
five files.

`mark-flow-grade`, `mark-flow-stroke` and `mark-flow-nest` are refinements of
the same gesture, kept in case the plain pair of chevrons reads too much like a
transport control. `preview-flow.html` compares all four, including at 14px,
which is the size the favicon actually renders at.

Social images are in [`docs/brand/social/`](docs/brand/social/) — X profile
pictures, with `preview-x.html` testing each at the sizes X actually renders
them (24–48px) across its three themes. Two of the five fail on X's default
dark theme; the README there says which and why.

Emails carry the wordmark only. Gmail strips inline SVG, and a hosted PNG needs
an absolute URL that does not exist until the site is deployed.

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

In production the same missing transport does NOT print the code — it throws,
and `/signin` says sign-in is unavailable. A production log line containing a
sign-in code would let anyone who can read `/var/log` sign in as anyone.

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

## The public site

`/` carries the sections that make no quantitative claim: how the money flows,
the comparison against the category, payout timing, and the FAQ. Payout timing
reads `TIER_RULES` — the same table the payout pipeline reads — so the page
cannot quote a hold window the product does not honour.

Deliberately absent until Phase 4: the proof table, the tier tables with
completion rates, the country checker and the dispute SLA. Every figure in them
has to come from a query (§8) and there is nothing to query yet. Also absent:
the team section, whose prototype content is `[Founder name]` and which §14 says
must not ship as a placeholder, and anything about the token, which is Phase 5
and legally gated.

### Policy pages

`/terms`, `/privacy` and `/reward-policy` are live. They were written from the
schema and the code rather than from a template — the Privacy notice lists the
columns that actually exist, and the Reward policy's hold windows come from
`TIER_RULES`.

**They have not been through legal review.** What is outstanding is listed in
[`docs/LEGAL-REVIEW.md`](docs/LEGAL-REVIEW.md), split into what blocks offer
network approval, what needs a lawyer, and what needs ALFA. The registered
entity is not named because §14 puts that with ALFA; until it is set in
`src/lib/legal.ts`, every policy page says so rather than printing a plausible
placeholder.

---

## The arcade (`/play`)

Seven games of our own — Blocks, Spot, SOS, Recall, Trail, Flood and Merge —
playable without an account. It is the only part of the site a stranger can *try* rather
than read, which is why it is not behind sign-in.

**The shelf is ordered by how long a game takes to understand, not by when it
was built.** Merge led for months because it shipped first, and watching
someone meet it cold settled it: a player who has to be taught a rule before
the screen means anything has already gone. Blocks and Spot explain themselves
in a glance and go first; Merge is the one you find after you already trust the
place. SOS sits third because half of Indonesia already learned it at a school
desk — a game somebody knows needs no instructions either.

**SOS's opponent is a rule, not a player.** It takes a line when it notices one,
looks one move ahead as often as the ladder says it should, and breaks ties out
of the same seeded stream as everything else — so the server replays both sides
of a match from the one player's moves.

Its difficulty was tuned by measurement, and every attempt to guess it was
wrong:

| What was tried | What it actually did |
|---|---|
| Always looks ahead | Won every endgame. A competent test player lost 0–10, 0–6, 0–5. |
| "Careless" = always write O | Made it *harder*: a board of O's means any S you write completes an S-O-_ it takes next turn, while it never writes the S's you could build on. |
| Always takes a line it sees | Beginners leave lines constantly, so 5×5 was unwinnable. It now misses about a third on board one and none by board four. |
| Mark the squares that give a line away, on every board | A player who only read the marks cleared the whole ladder 5 times out of 5. Restricted to board one: the same player finishes on 1, 2, 3, 3 and 3 boards. |

The last row is the rule for any assist added here: if following it wins the
game, it is not an assist, it is the game.

**Every score in the database is the score of a round that was actually played.**
A browser never sends a score; it sends the moves, and the server replays them
with the same rules the browser ran and takes its own result. That works because
every game is deterministic from a seed the server issued — one seeded generator
drives every tile, fruit, colour and shuffle — and because a move the board would
not allow fails the whole submission rather than being skipped.

**A credit will need an account, and visitors are told so before they play**
(`canEarn()` in `src/lib/ads/rewarded.ts`). Two refusals in a deliberate order:
the network first, because it decides whether there is money at all; the account
second, because it decides whether there is anyone to give it to. The second is
arithmetic rather than policy — a credit is a row against a user id, and a
guest round is never written down, so `/api/play/start` refuses it a session and
there is nobody to owe afterwards. The games stay free either way; what needs an
account is the claim.

**Every game has a board for today and a board for the week**
(`src/lib/games/board.ts`), which is what a score is *for* while nothing pays: a
position rather than a number on your own screen. One row per player, not per
round; `publicPayouts = false` hides the handle and never the row; and a player
outside the visible ten is told their real rank, because that is nearly
everyone. The weekly window is `currentWeek()` — the same Sunday-to-Sunday UTC
window §9 accrues against, not a second definition of a week.

**The daily board is the one that compares like with like**
(`src/lib/games/daily.ts`). The weekly board ranks the best score anyone reached
on any seed, which measures how many rounds somebody had time for as much as how
well they played. The daily board hands every player the same seed — same grid,
same pieces, same deal — and ranks their **first finished round**, because
best-of on a fixed board is a restart button. The seed is
`FNV-1a("<game>:<YYYY-MM-DD>")`, derived on the server: `/api/play/start` takes
`{ daily: true }` and never a seed, so a browser cannot ask for a kinder day. It
is derived in the open rather than from a secret, which lets tomorrow's board be
worked out a day early — by the same person who could already solve any seed —
and lets two players check they were given the same one, which is the property
the board exists for. Guests play the day's board and do not appear on it: the
same line as everywhere else, no account, no row.

Being able to do this at all is a consequence of the two decisions above. A
board everyone shares is only meaningful if the games are deterministic from a
seed and the scores were recomputed rather than reported, and both were already
true.

**No board pays anything, and the gate that would have to open is written down**
(`src/lib/games/prizes.ts`) in the same shape as the ad-network gate: named,
listed, and refusing. Two locks, both shut. *Money*: a ranking prize has to be
funded by somebody, and with no ad network the only source is the company's own
float — paying members out of capital, which is the arrangement this product
exists to not be. *Law*: paying a leaderboard from a pot, on a schedule, by
rank, is a lottery in several jurisdictions, and §9 already puts the token half
behind a written legal go-ahead. Until both open, no screen mentions a prize.

**Sound is three synthesised blips and a switch** (`src/components/games/sound.ts`,
wired once in `useRound` so every game gets it). Nothing is fetched, so nothing
can fail to load; the audio context is built on the first cue rather than on
page load, because browsers refuse one before a gesture. The switch sits beside
the score on every board and is remembered per browser — and every read of that
preference is wrapped, because a board that will not render for want of a mute
setting is a worse bug than an unwanted noise. Trail passes `clicks: false`: it
sends a move eight times a second, and a click on each is a fault, not feedback.

**Spot's clock is in the board, not in the rules** (`spot-board.tsx`). A replay
can prove a tap was legal and can never prove it was quick, so the timer ends
the round and adds nothing to the score — what the server recomputes is levels
cleared, which is exactly what it can check. Any game that wants a clock keeps
it on the same terms; `useRound().stop()` is how a board ends a round for a
reason the rules do not model.

What a replay proves is that the round is a legal game, not that a human played
it: a program can play a legal game, and Recall's deal can be recomputed by
anyone who wants it badly enough. That gap is not closable in a browser, which
is why the gate on turning a score into money is an ad network's server-side
callback (`src/lib/ads/rewarded.ts`) and not a high score. **No game pays
anything today**, and every game page says so rather than showing a counter that
never becomes a payout.

**Adding a game** is a rules object and a catalog entry:

| Step | Where |
|---|---|
| Pure rules, no React, no `Math.random`, no `Date.now()` | `src/lib/games/<slug>.ts` |
| `GameRules`: `create`, `parse`, `maxMoves` | same file, exported |
| Title, tagline, how-to, what its second number means | `GAMES` in `src/lib/games/catalog.ts` |
| The board | `src/components/games/<slug>-board.tsx`, via `useRound` |
| Its mark on the shelf | `GameMark` in `src/components/games/game-mark.tsx` |
| A bot that plays it, for the tests | `PLAYERS` in `src/test/players.ts` |

No migration: `GameSession.game` is a slug, and `bestTile` holds whatever second
number the game names (`bestLabel`) — lines cleared, level reached, best tile,
trail length, tiles filled, best streak. The catalog is also the security boundary —
a slug that is not a key in it is not a game, and a round is always scored with
the rules of the slug *stored on its row*, never one that arrives with the moves.
`src/lib/games/catalog.test.ts` holds every game to that contract in one loop, so
a fifth game cannot quietly ship without meeting it.

---

## What a member can do while there are no tasks

`src/lib/readiness.ts`, shown on `/dashboard` and on `/tasks` when the list is
empty — which today is always.

The honest problem: the task machinery is finished and the inventory is zero,
because no offer network has approved us. A member who signs up finds a page
with nothing on it, and games are something to do rather than something to
finish. So this is a short, finite list of the things that are real work today —
country on file, a verified payout wallet, the waiting list for their country,
reward emails on, a referral, a finished round — every one checked against the
database rather than ticked by clicking.

**None of them pay, and the card says so in its first sentence.** What they buy
is the day tasks arrive: a member with a verified wallet and a known country is
paid that day, and one without either is a support ticket at the worst possible
moment.

Deliberately absent: streaks, daily check-ins, badges. Rewarding somebody for
opening a page is a way of having activity without having a product, and a test
fails if any step's copy starts quoting money.

---

## Member surfaces (Phase 0.2)

Added after the handoff was written. Four of the five sit on top of Phase 1 data,
so they are built and tested against the real queries and currently render the
honest empty state — never a seeded number.

| Surface | State today |
|---|---|
| `/settings` | **Live.** `publicPayouts`, email preferences, country. The prototype's proof table promises "can be hidden in your settings"; this is that page. |
| `/referrals` | **Live.** Your code, your link, and everyone credited to you. The commission rate is not set — see below. |
| Notifications | **Plumbing live**, events land in Phases 1–2. Preferences, one-click unsubscribe and `List-Unsubscribe` headers all work now. |
| `/leaderboard` | Real query, empty until there are confirmed rewards. |
| `/history` + CSV | Real query, empty until there is activity. |
| Withdrawal ladder | **Live** on the dashboard, driven by the same `TIER_RULES` table the payout pipeline will read. |

**Referral attribution is why this could not wait.** A referral that is not
captured at signup can never be backfilled — the visitor is gone. The graph is
recorded from now on; what a referral pays can be decided later, and the page
says so rather than inventing a rate.

**Referral is a fraud vector, so the rules shipped with it** (`src/lib/referral.ts`).
A refused referral never blocks the signup — the account is created uncredited.
Blocking on a heuristic this weak would lock out flatmates and office networks.
Today it refuses an unknown code, a suspended referrer, and a signup from the
same source as the referrer's own. Device fingerprinting is §7 and lands in
Phase 1; add the check there.

**Payment rails stay crypto-only** — Solana USDC and Base ETH, per §6.2. Local
rails and gift cards were considered and deliberately not built.

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
| Indexing opt-in | `NEXT_PUBLIC_ALLOW_INDEXING` | Staging cannot be indexed by omission. `robots.txt` and `/sitemap.xml` are both derived from `src/lib/sitemap.ts` and both go silent when it is unset — the two disagreeing is how a staging box ends up in a search result, and a test asserts the sitemap offers nothing robots blocks. |
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
  `kv()` is the request-path connection and fails within about a second, via
  `commandTimeout` rather than by disabling the offline queue — disabling it
  also rejects commands issued while the socket is still opening, which fails
  the first sign-in after every restart. Anything serving an HTTP request uses
  `kv()`.

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
    referral.ts       Code format and the anti-abuse attribution rules
    notify.ts         Notification email. Never the sign-in code.
    risk.ts           The §6.1 hold ladder — one table, UI and payouts share it
    leaderboard.ts    Top workers by confirmed rewards (also feeds §9)
    games/            The arcade: one file of pure rules per game, one
                      catalog, one replay. See "The arcade" above.
    statement.ts      A member's own auditable record, and its CSV
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
