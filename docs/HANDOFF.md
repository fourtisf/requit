# HANDOFF — {{BRAND}}

**Advertiser-funded task platform with a revenue-share token layer.**

Prepared for: Michael
Source of design truth: `requit.html` (single-file prototype, delivered alongside this doc)
Date: September 2026

---

## 0. Before you write any code

Read this section fully. Three things in this project will kill it if they are treated as afterthoughts, and none of them are frontend problems.

### 0.1 The brand name is a placeholder

Every occurrence of `{{BRAND}}` in this document and `Requit` in the prototype is a placeholder. ALFA will confirm the final name. Implement it as a single exported constant so the swap is one edit:

```ts
// lib/brand.ts
export const BRAND = {
  name: "Requit",
  domain: "requit.com",
  ticker: "RQT",
  supportEmail: "support@requit.com",
} as const;
```

Do not hardcode the name anywhere else. Not in copy, not in email templates, not in meta tags.

### 0.2 The token layer is legally gated

Phase 5 (vault, snapshot, distributions) **must not ship** until ALFA confirms a lawyer has reviewed it. A token that pays holders a share of company revenue on a schedule has securities characteristics in most jurisdictions.

Build Phases 0–4 first. They are a complete, standalone, revenue-generating business with no token in it. If the legal review comes back negative, Phases 0–4 still ship and still work.

**Do not build Phase 5 speculatively "so it's ready."** Ask ALFA before starting it.

### 0.3 The float will break you before the code does

Offer networks pay publishers on NET-15 to NET-30 terms. Users withdraw from $10, within hours.

That means the company fronts every payout from its own cash for two to four weeks. At 500 active users this is several thousand dollars permanently in flight. Undercapitalised reward sites do not die from bugs — they die from running out of working capital during growth.

The treasury dashboard in Phase 3 is not a nice-to-have. It is the instrument that tells ALFA when to slow down. Build it properly.

---

## 1. Stack

Match the existing Fourtis deployment pattern.

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript strict | |
| Styling | Tailwind CSS | Port the prototype's CSS variables into the Tailwind theme |
| Database | PostgreSQL 16 | |
| ORM | Prisma | |
| Queue | BullMQ on Redis | Postbacks, payouts, snapshot job |
| Auth | Auth.js (email OTP + optional Google) | No password storage |
| EVM | viem | Base, chain id 8453 |
| Solana | `@solana/web3.js`, `@solana/spl-token` | |
| Deploy | VPS, PM2, Nginx, Cloudflare | Same pattern as WhaleFlow |
| Monitoring | Sentry + a Telegram alert bot | |

**Do not use serverless for the postback endpoint.** It needs a stable IP for network allowlisting and predictable cold-start behaviour. Run it on the VPS.

---

## 2. Architecture

```
Offer networks ──S2S postback──►  /api/postback/[network]
                                        │
                                  verify sig + IP
                                  dedupe on txn id
                                        │
                                        ▼
                                  Reward (PENDING → AVAILABLE)
                                        │
                        ┌───────────────┼───────────────┐
                        ▼               ▼               ▼
                  User balance    Dispute engine   Revenue ledger
                        │                               │
                        ▼                               ▼
                  Withdrawal queue                 Vault (Phase 5)
                        │                               │
              ┌─────────┴─────────┐                     ▼
              ▼                   ▼               Weekly snapshot
        Solana USDC          Base ETH             + buy + distribute
```

Three subsystems, three failure domains. Keep them separated so an outage in one does not stop the others.

---

## 3. Data model

```prisma
// schema.prisma

model User {
  id             String   @id @default(cuid())
  email          String   @unique
  handle         String   @unique
  countryCode    String   @db.Char(2)
  createdAt      DateTime @default(now())

  riskTier       RiskTier @default(NEW)
  publicPayouts  Boolean  @default(true)   // shows handle on the proof table
  suspendedAt    DateTime?
  suspendReason  String?

  wallets        Wallet[]
  rewards        Reward[]
  withdrawals    Withdrawal[]
  disputes       Dispute[]
  devices        Device[]

  @@index([countryCode])
  @@index([riskTier])
}

enum RiskTier {
  NEW        // 72h withdrawal hold
  STANDARD   // 24h hold
  TRUSTED    // instant
  FLAGGED    // manual review on every withdrawal
}

model Wallet {
  id          String     @id @default(cuid())
  userId      String
  user        User       @relation(fields: [userId], references: [id])
  chain       Chain
  address     String
  verifiedAt  DateTime?
  isPayout    Boolean    @default(false)

  @@unique([chain, address])   // one wallet, one account — anti multi-account
  @@index([userId])
}

enum Chain { SOLANA BASE }

model Offer {
  id             String   @id @default(cuid())
  network        Network
  networkOfferId String
  name           String
  description    String?
  category       OfferCategory
  countries      String[]           // ISO-2, empty = all
  devices        String[]           // ios | android | desktop
  advertiserPays Decimal  @db.Decimal(10,4)   // NEVER expose via public API
  userPays       Decimal  @db.Decimal(10,4)   // what we show
  requiresPurchase Boolean @default(false)
  purchaseAmount Decimal? @db.Decimal(10,2)
  deadlineDays   Int?
  isActive       Boolean  @default(true)
  lastSeenAt     DateTime @default(now())

  tiers          OfferTier[]

  @@unique([network, networkOfferId])
  @@index([isActive, category])
}

enum Network { CPX LOOTABLY TIMEWALL TOROX }
enum OfferCategory { SURVEY GAME APP SIGNUP MICROTASK SHOPPING }

model OfferTier {
  id             String  @id @default(cuid())
  offerId        String
  offer          Offer   @relation(fields: [offerId], references: [id], onDelete: Cascade)
  sequence       Int
  label          String            // "Board level 32"
  userPays       Decimal @db.Decimal(10,4)
  completions    Int     @default(0)
  starts         Int     @default(0)
  // completionRate is DERIVED: completions / starts. Never store a manual number.

  @@unique([offerId, sequence])
}

model Reward {
  id             String       @id @default(cuid())
  userId         String
  user           User         @relation(fields: [userId], references: [id])
  offerId        String?
  network        Network
  networkTxnId   String                        // idempotency key
  tierLabel      String?
  amount         Decimal      @db.Decimal(10,4)
  advertiserPaid Decimal      @db.Decimal(10,4)
  status         RewardStatus @default(PENDING)
  availableAt    DateTime?
  reversedAt     DateTime?
  countryCode    String       @db.Char(2)
  rawPayload     Json

  createdAt      DateTime     @default(now())

  @@unique([network, networkTxnId])            // hard dedupe
  @@index([userId, status])
  @@index([createdAt])
}

enum RewardStatus { PENDING AVAILABLE REVERSED WITHHELD }

model Withdrawal {
  id            String           @id @default(cuid())
  userId        String
  user          User             @relation(fields: [userId], references: [id])
  walletId      String
  chain         Chain
  amount        Decimal          @db.Decimal(10,4)
  status        WithdrawalStatus @default(REQUESTED)
  txHash        String?
  failureReason String?
  requestedAt   DateTime         @default(now())
  settledAt     DateTime?

  idempotencyKey String          @unique

  @@index([userId])
  @@index([status])
  @@index([settledAt])
}

enum WithdrawalStatus { REQUESTED HELD APPROVED SENDING SETTLED FAILED }

model Dispute {
  id            String        @id @default(cuid())
  userId        String
  user          User          @relation(fields: [userId], references: [id])
  offerId       String?
  network       Network
  claimedAmount Decimal       @db.Decimal(10,4)
  evidenceUrls  String[]
  status        DisputeStatus @default(SUBMITTED)
  statusNote    String?
  firstReplyAt  DateTime?
  escalatedAt   DateTime?
  resolvedAt    DateTime?
  outcome       DisputeOutcome?
  createdAt     DateTime      @default(now())

  @@index([status])
  @@index([userId])
}

enum DisputeStatus { SUBMITTED ACKNOWLEDGED ESCALATED AWAITING_NETWORK RESOLVED }
enum DisputeOutcome { PAID REJECTED_BY_ADVERTISER EXPIRED WITHDRAWN }

model Device {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id])
  fingerprint  String
  ipHash       String
  vpnScore     Int?
  firstSeenAt  DateTime @default(now())
  lastSeenAt   DateTime @default(now())

  @@index([fingerprint])
  @@index([ipHash])
}

model NetworkInvoice {
  id           String   @id @default(cuid())
  network      Network
  periodStart  DateTime
  periodEnd    DateTime
  amountDue    Decimal  @db.Decimal(12,2)
  amountPaid   Decimal? @db.Decimal(12,2)
  paidAt       DateTime?

  @@unique([network, periodStart])
}
```

Phase 5 models (`Distribution`, `SnapshotHolder`, `VaultLedger`) are specified in §9 and must not be migrated until the legal gate clears.

---

## 4. Offer network integration

### 4.1 The pattern

All four networks work the same way:

1. We render their offerwall in an iframe with our `user_id` as the sub-id, or we pull their offer list via API and render it ourselves.
2. The user completes an offer on the advertiser's property.
3. The network sends a **server-to-server postback** to a URL we register in their dashboard.
4. We verify, dedupe, credit.

**Render their wall in an iframe for v1.** Pulling and rendering the catalog ourselves is Phase 4 work — it gives us the tier tables and completion rates the prototype promises, but it is significantly more surface area.

### 4.2 Postback endpoint

`GET /api/postback/[network]` — networks use GET with query params. Accept POST too.

Every handler does these six things in this order. Do not reorder them.

```ts
// 1. IP allowlist — each network publishes its postback IPs.
//    Get the current list from the network dashboard, put it in env.
if (!ALLOWED_IPS[network].includes(clientIp)) return new Response("forbidden", { status: 403 });

// 2. Signature verification.
//    Each network signs differently — typically MD5 or HMAC-SHA256 over a
//    concatenation of specific params plus your secret key.
//    DO NOT guess the formula. Read the current integration doc in each
//    network's publisher dashboard and implement exactly what it specifies.
//    Test with their sandbox postback tool before going live.
if (!verifySignature(network, params, secret)) return new Response("bad signature", { status: 403 });

// 3. Idempotency. Networks retry on non-200. The unique constraint on
//    (network, networkTxnId) is the real guard — catch the Prisma P2002
//    and return 200 OK so they stop retrying.

// 4. Handle status. Most networks send status=1 for credit, status=2 for
//    reversal/chargeback. A reversal on an already-withdrawn reward is a
//    real loss — record it, flag the user, do NOT create a negative balance
//    the user can never clear.

// 5. Credit. status=PENDING, availableAt = now + holdWindow(user.riskTier).
//    A background job flips PENDING → AVAILABLE when availableAt passes.

// 6. Respond exactly what the network expects — usually the literal string
//    "OK" or "1" with HTTP 200. Anything else triggers retries forever.
```

### 4.3 Network-specific notes

| Network | Wall type | Watch for |
|---|---|---|
| CPX Research | Survey iframe, needs user profile params (age, gender) for matching | Screen-outs are the majority of sessions. Do not count a screen-out as a failure in your metrics — it is normal. |
| Lootably | Offerwall iframe + API | Broadest category mix. Their API exposes payout tiers, which feeds our tier tables. |
| TimeWall | Iframe | Lowest per-task value, highest volume. Rate-limit our own UI so it does not look like spam. |
| Torox | Iframe + API | Formerly OfferToro. Carries the high-value multi-tier game offers. Highest chargeback rate — treat with the most caution. |

**Each network must be approved before integration.** ALFA applies as a publisher; approval needs a live domain, a privacy policy, terms, and traffic evidence. Do not build against a network we have not been approved for — the sandbox credentials will not survive to production.

### 4.4 The tier table (the product's differentiator)

The prototype's central claim is that we publish the completion rate per tier. This is only credible if it is computed, never typed.

```
completionRate(tier) = tier.completions / tier.starts
```

- `starts` increments when a user opens the offer through our link.
- `completions` increments on a confirmed postback for that tier.
- Display "Not enough data" until `starts >= 30`. Never show a rate derived from a handful of samples.
- Recompute nightly, cache the result.

If a tier's rate falls below 5%, render it struck through, exactly as the prototype does.

---

## 5. Wallet verification

Signature only. We never take a seed phrase, and we never request a transaction to verify.

**Flow:**
1. `POST /api/wallet/nonce` → returns a single-use nonce, 10-minute TTL, stored server-side against the session.
2. Client signs a human-readable message containing the nonce, domain, chain, and timestamp.
3. `POST /api/wallet/verify` → server verifies and marks `verifiedAt`.

**EVM (Base):** EIP-4361 message format, verify with viem's `verifyMessage`. Support smart-contract wallets via EIP-1271 if it is cheap to do; skip otherwise.

**Solana:** verify an ed25519 signature over the message bytes against the public key using `tweetnacl`.

**Hard rules:**
- Nonce is consumed on first use. Replay must fail.
- The `@@unique([chain, address])` constraint means one wallet can only ever belong to one account. Return a clear error, not a 500.
- Never verify a wallet the user did not sign for in this session.

---

## 6. Payout pipeline

### 6.1 Withdrawal request

```
POST /api/withdraw  { walletId, amount, idempotencyKey }
```

Inside a single transaction:
1. Lock the user row (`SELECT ... FOR UPDATE`).
2. Recompute available balance from `Reward` rows — **never trust a cached balance column**.
3. Reject if `amount < 10` or `amount > available`.
4. Apply the risk hold: `NEW` → `HELD` for 72h, `STANDARD` → 24h, `TRUSTED` → `APPROVED` immediately, `FLAGGED` → `HELD` pending manual review.
5. Create the `Withdrawal` row with the client-supplied `idempotencyKey` on a unique constraint.

A duplicate `idempotencyKey` returns the **existing** withdrawal, not a new one. This is the single most important guard in the whole system — without it, a double-clicked button drains the hot wallet.

### 6.2 Execution worker

A BullMQ worker picks up `APPROVED` withdrawals.

**Solana USDC:**
- SPL transfer from the hot wallet's associated token account.
- If the recipient has no USDC ATA, create it — costs about 0.002 SOL in rent, paid by us. Budget for it.
- Confirm at `confirmed`, then write `txHash` and flip to `SETTLED`.

**Base ETH:**
- Plain ETH transfer via viem.
- Wait for one confirmation.

**Both:**
- Set status to `SENDING` **before** broadcasting, and persist the resulting hash immediately. If the process dies between broadcast and write, a reconciliation job must be able to find the transaction by scanning the hot wallet's outbound history and match it to the pending row. Write that job in Phase 2, not later.
- Never retry a `SENDING` row automatically. It goes to manual review.

### 6.3 Key management

Do not put production private keys in a plaintext `.env` on the VPS.

Minimum acceptable: keys encrypted at rest, decrypted into memory at process start using a passphrase supplied out-of-band (not in the repo, not in the deploy script). Better: a signing service on a separate host that only exposes `sign(tx)`.

**Hot wallet holds a working float only.** Target: roughly three days of expected payouts. The rest sits in a cold wallet ALFA controls. A daily job alerts when the hot wallet drops below two days of cover.

---

## 7. Fraud and risk

This category attracts organised abuse. Assume it from day one.

**At signup:**
- Device fingerprint (FingerprintJS OSS or similar) stored per user.
- IP reputation via IPQualityScore or equivalent. A VPN/datacenter IP does not auto-ban, but it sets `riskTier = FLAGGED`.
- Email disposable-domain check.

**Continuous:**
- Same `fingerprint` across more than two accounts → flag all of them.
- Same `ipHash` across more than five accounts in 24h → flag.
- Reward velocity far above the country median → flag.
- Any user with a chargeback rate over 20% across ten or more rewards → `FLAGGED`, withdrawals to manual review.

**Why this matters commercially:** networks monitor publisher traffic quality. If our conversions get reversed at a high rate, they cut us off — and losing Torox or Lootably is losing the inventory that makes the product worth using. Fraud control is not user-hostile here; it is what keeps the supply on.

**What not to do:** do not ban silently. A flagged user sees a clear message and a route to appeal. Silent bans generate exactly the public complaints the prototype's whole positioning is designed to avoid.

---

## 8. Public proof endpoints

The prototype makes four public, verifiable claims. Each needs a real endpoint. All are cached (60s) and rate-limited.

```
GET /api/public/payouts        → last 12 settled withdrawals
                                  { date, handle|null, chain, txHash, amount }
                                  handle omitted when user.publicPayouts = false

GET /api/public/stats          → { paidToDate, paidLast7d, withdrawalCount, refusedCount }

GET /api/public/availability?country=US
                               → { offerCount, networksLive, qualifyRate,
                                   surveyRange, bestRealisticTier, rails, note }
                                  All computed from live Offer rows and 90-day
                                  reward history. The `note` string is editable
                                  per country in admin — it is editorial, not derived.

GET /api/public/sla            → { firstReplyHours, escalationHours,
                                   medianResolutionDays, paidRate }
                                  Rolling 90-day, computed from Dispute rows.
```

**These numbers must be computed, not configured.** The entire trust proposition collapses the first time someone notices a hardcoded figure. If a number cannot be computed yet, return `null` and have the frontend hide that row rather than showing a placeholder.

The prototype shows `0` refused withdrawals. That is a computed count of `Withdrawal.status = FAILED` where the failure was our decision rather than a chain error. If it ever stops being zero, it displays the real number.

---

## 9. Phase 5 — vault and distributions (LEGALLY GATED)

**Do not start without written confirmation from ALFA.**

```prisma
model VaultLedger {
  id             String   @id @default(cuid())
  weekNumber     Int      @unique
  periodStart    DateTime
  periodEnd      DateTime
  taskMargin     Decimal  @db.Decimal(12,2)
  tradingFeeShare Decimal @db.Decimal(12,2)
  totalFunded    Decimal  @db.Decimal(12,2)
  snapshotBlock  BigInt?
  buyTxHash      String?
  tokensBought   Decimal? @db.Decimal(24,8)
  distTxHashes   String[]
  status         VaultStatus @default(ACCRUING)
}

enum VaultStatus { ACCRUING SNAPSHOT_TAKEN BOUGHT DISTRIBUTED FAILED }

model SnapshotHolder {
  id           String   @id @default(cuid())
  weekNumber   Int
  address      String
  balance      Decimal  @db.Decimal(24,8)
  share        Decimal  @db.Decimal(10,8)
  amountSent   Decimal? @db.Decimal(24,8)

  @@unique([weekNumber, address])
}
```

**Sunday 20:00 UTC job, in strict order:**

1. Freeze the accounting period. Compute `taskMargin` as `SUM(advertiserPaid - amount)` over rewards confirmed in the window. Record `snapshotBlock`.
2. Read `balanceOf` at that exact block for every verified Base wallet. This requires an **archive node** — Alchemy or QuickNode on Base. A standard RPC will not serve historical state and will silently return current balances, which would be a serious integrity failure.
3. Filter to balances ≥ 100,000. Compute pro-rata shares.
4. Compute the top 50 workers by confirmed rewards in the same window.
5. Execute the buy on Uniswap v3 (Base). Set an explicit slippage limit and a deadline. Split into tranches if the size is meaningful against pool depth. If slippage exceeds the limit, **abort and alert** — do not push the trade through.
6. Distribute. Use a batch-transfer contract rather than individual transfers; per-recipient gas across a hundred wallets is otherwise wasteful.
7. Write every hash to `VaultLedger`. Publish immediately.

**Failure handling:** if any step fails, set `status = FAILED`, alert ALFA, and publish the failure on the token page with a plain explanation. The prototype's ledger deliberately shows a bad week ($9,704) — that pattern is the point. A ledger that only shows successes is not a ledger.

---

## 10. Build phases and acceptance criteria

### Phase 0 — Scaffold
Next.js + Prisma + Redis + Auth.js. Docker compose for local Postgres and Redis. CI running typecheck, lint, and tests.
**Accept when:** a user can sign up with email OTP, land on an empty dashboard, and the CI is green.

### Phase 1 — Offer ingestion and postbacks (STAGING ONLY)
Offer sync jobs for all four networks. Postback endpoint with signature verification, IP allowlist, dedupe, reversal handling. Task list UI filtered by country and device.
**Accept when:** a sandbox postback from each of the four networks credits exactly one reward, a replayed postback credits zero additional rewards, and a reversal postback correctly reverses.

> **STOP HERE. Deploy to staging and get ALFA's approval before Phase 2.**
> Do not proceed on your own judgement. This gate exists because everything after it moves real money.

### Phase 2 — Wallets and withdrawals
Nonce/verify flow for both chains. Withdrawal request with idempotency and risk holds. Execution workers. Reconciliation job.
**Accept when:** a testnet withdrawal settles end to end, a double-submitted request produces exactly one transaction, and killing the worker mid-send leaves a row the reconciliation job can recover.

### Phase 3 — Disputes, admin, treasury
Dispute submission with evidence upload and a visible status. Admin queue. Treasury dashboard showing owed-to-users, receivable-from-networks, and hot wallet cover in days.
**Accept when:** the treasury dashboard reconciles to the cent against the database, and a dispute moves through every status with timestamps that feed the public SLA endpoint.

### Phase 4 — Public proof pages
Port the prototype exactly. All four public endpoints live and computed. Country checker reading real inventory.
**Accept when:** every number on the public site traces to a query, and no figure in the codebase is a literal.

### Phase 5 — Vault
Only after ALFA's written go-ahead. See §9.

---

## 11. Claude Code prompt sequence

Run these in order. Do not skip ahead. After each, verify the acceptance criteria before moving on.

1. **Scaffold.** "Set up a Next.js 15 App Router project with TypeScript strict, Tailwind, Prisma with PostgreSQL, BullMQ on Redis, and Auth.js with email OTP. Add docker-compose for Postgres and Redis. Add a GitHub Action running typecheck, lint and vitest."

2. **Schema.** "Implement the Prisma schema in §3 of HANDOFF.md exactly. Generate the migration. Write a seed script creating 5 users across 5 countries, 30 offers spread across all four networks and six categories, and tier rows for the game offers."

3. **Design system.** "Port the CSS custom properties and component styles from requit.html into the Tailwind theme and a set of React primitives: Button, Card, Table, Stat, Chip, Badge. Match the prototype pixel for pixel. Dark theme only."

4. **Offer sync.** "Build a BullMQ repeatable job per network that pulls the offer catalog into the Offer and OfferTier tables. Normalise categories, countries and device targeting. Mark offers absent from a sync as inactive rather than deleting them."

5. **Postback endpoint.** "Implement /api/postback/[network] following §4.2 exactly — IP allowlist, signature verification, idempotent dedupe on (network, networkTxnId), reversal handling, risk-tier hold windows, and the literal response body each network expects. Write vitest coverage for: valid credit, replayed postback, bad signature, disallowed IP, and reversal of an already-withdrawn reward."

6. **Task list.** "Build the dashboard task list filtered by the user's country and device. Show tier tables with computed completion rates, hiding rates below 30 samples. Render purchase-required offers with the amber label. Strike through tiers under 5% completion."

7. **Wallet verification.** "Implement the nonce/sign/verify flow for Base (EIP-4361 via viem) and Solana (ed25519 via tweetnacl) per §5. Single-use nonces with a 10-minute TTL. Enforce the one-wallet-one-account constraint with a clear user-facing error."

8. **Withdrawals.** "Implement the withdrawal request and execution pipeline per §6, including row locking, balance recomputation from Reward rows, idempotency keys, risk holds, the Solana USDC and Base ETH workers, and the reconciliation job. Test the double-submit and mid-send-crash cases."

9. **Disputes and treasury.** "Build dispute submission with evidence upload, the admin queue, status transitions with timestamps, and the treasury dashboard showing owed-to-users, receivable-from-networks, and hot wallet days of cover."

10. **Public site.** "Port the full requit.html marketing site into the app. Implement the four public endpoints in §8, all computed from live data with 60s caching and rate limiting. Where a figure cannot yet be computed, return null and hide the row."

---

## 12. Environment variables

```bash
# core
DATABASE_URL=
REDIS_URL=
NEXTAUTH_SECRET=
NEXT_PUBLIC_APP_URL=

# offer networks — one set per network
CPX_APP_ID=
CPX_SECRET=
CPX_POSTBACK_IPS=          # comma-separated, from their dashboard
LOOTABLY_PLACEMENT_ID=
LOOTABLY_API_KEY=
LOOTABLY_POSTBACK_IPS=
TIMEWALL_PUBLISHER_ID=
TIMEWALL_SECRET=
TIMEWALL_POSTBACK_IPS=
TOROX_APP_ID=
TOROX_SECRET=
TOROX_POSTBACK_IPS=

# chains
BASE_RPC_URL=              # archive node required for Phase 5
SOLANA_RPC_URL=
HOT_WALLET_KEYSTORE_PATH=  # encrypted, NOT a raw key
HOT_WALLET_PASSPHRASE=     # supplied at process start, not committed
USDC_MINT=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v

# risk
IPQS_API_KEY=

# ops
SENTRY_DSN=
TELEGRAM_ALERT_BOT_TOKEN=
TELEGRAM_ALERT_CHAT_ID=
```

---

## 13. Things that will go wrong, and what to do

| Symptom | Almost always | Fix |
|---|---|---|
| Rewards credited twice | Postback retried and dedupe missed | The unique constraint is the guard. Catch P2002, return 200. |
| Network stops sending postbacks | We returned non-200 too often and got disabled | Always return 200 with their expected body, even on our internal errors. Log the error separately. |
| Hot wallet drained | Missing idempotency on withdrawal | §6.1. Non-negotiable. |
| Users report unpaid offers | Attribution lost — they installed outside our link | Frontend must warn before opening any offer. Not fixable server-side. |
| Network terminates us | Traffic quality | §7. Fraud control protects supply, not just margin. |
| Snapshot balances all identical | Non-archive RPC silently returned current state | Verify the RPC supports historical `balanceOf` before trusting a single distribution. |
| Cash runs out during growth | The float, exactly as described in §0.3 | Treasury dashboard. Watch it weekly. |

---

## 14. Questions for ALFA, not for you to decide

Do not improvise on any of these. Ask.

1. Final brand name and domain.
2. Whether Phase 5 is legally cleared, and in which jurisdiction the entity is registered.
3. Which names, photos and links go on the team section — the prototype has placeholders and they must not ship as placeholders.
4. Starting float: how much working capital is available to front payouts.
5. Whether to launch with all four networks or start with the one or two we are approved for first.
6. The country `note` strings on the availability checker — these are editorial and ALFA owns the voice.

---

**Prototype is the design source of truth. This document is the technical source of truth. Where they disagree, ask ALFA rather than picking one.**
