-- Referral graph and notification preferences.
--
-- `referralCode` and `unsubscribeToken` are NOT NULL and unique, so they are
-- added nullable, backfilled, and only then constrained. Adding them as NOT NULL
-- in one step fails on any table that already has rows — which is every
-- deployment except a brand new one.

-- ── Notification preferences ────────────────────────────────────────────────
-- Defaults make these safe to add in one step. Existing users are opted IN:
-- these notifications tell someone their money moved, and defaulting them off
-- would mean silently withholding that.
ALTER TABLE "User"
  ADD COLUMN "notifyRewards"     BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyWithdrawals" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "notifyDisputes"    BOOLEAN NOT NULL DEFAULT true;

-- ── Referral graph ──────────────────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN "referredAt"   TIMESTAMP(3),
  ADD COLUMN "referredById" TEXT,
  ADD COLUMN "signupIpHash" TEXT;

-- ── Backfilled unique columns ───────────────────────────────────────────────
ALTER TABLE "User"
  ADD COLUMN "referralCode"     TEXT,
  ADD COLUMN "unsubscribeToken" TEXT;

-- Codes are uppercase hex here rather than the application's Crockford base32.
-- Both avoid the confusable characters (I, L, O, U); this form is what Postgres
-- can produce without an extension. New rows get their code from
-- src/lib/referral.ts.
UPDATE "User"
SET "referralCode"     = upper(substr(md5(random()::text || "id"), 1, 8)),
    "unsubscribeToken" = gen_random_uuid()::text
WHERE "referralCode" IS NULL;

ALTER TABLE "User"
  ALTER COLUMN "referralCode"     SET NOT NULL,
  ALTER COLUMN "unsubscribeToken" SET NOT NULL;

CREATE UNIQUE INDEX "User_referralCode_key"     ON "User"("referralCode");
CREATE UNIQUE INDEX "User_unsubscribeToken_key" ON "User"("unsubscribeToken");
CREATE INDEX "User_referredById_idx" ON "User"("referredById");

-- ON DELETE SET NULL, not CASCADE: deleting a referrer must never delete the
-- people they referred.
ALTER TABLE "User"
  ADD CONSTRAINT "User_referredById_fkey"
  FOREIGN KEY ("referredById") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
