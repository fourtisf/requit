/**
 * Whether a finished game can be turned into money yet.
 *
 * It cannot, and this file is why.
 *
 * Our own games earn through rewarded video: an ad network pays us per verified
 * view. The only safe moment to credit a member is when that network tells our
 * server the ad was watched — a signed server-side verification callback, from
 * them to us. A browser saying "the ad finished" is not evidence of anything;
 * it is a line anyone can run in a console, and every app that credits on it
 * gets drained within days of being worth draining.
 *
 * We have no ad network account, so there is no callback, no signing key, and
 * no revenue. Crediting anyone now would mean paying real money out of the
 * float for advertising that was never sold — the company funding its own
 * members' rewards, which is the arrangement this product exists to not be.
 *
 * So the gate holds, in the same shape as the network signature specs and the
 * sub-id specs: named, unconfirmed, and refusing. The game is fully playable
 * meanwhile; it just does not pretend to pay.
 */

export type AdNetwork = "ADMOB" | "UNITY" | "APPLOVIN";

export type RewardedSpec = {
  /**
   * Flip only when all of these are true, together:
   *   1. A publisher account with this network is approved for requit.xyz.
   *   2. Server-side verification is switched on in their dashboard, with our
   *      callback URL and their signing key configured.
   *   3. That callback's signature is verified by our own code and tested
   *      against their sandbox.
   * Any one of these missing means we would be paying for nothing.
   */
  confirmed: boolean;
};

export const REWARDED_SPECS: Record<AdNetwork, RewardedSpec> = {
  ADMOB: { confirmed: false },
  UNITY: { confirmed: false },
  APPLOVIN: { confirmed: false },
};

export type EarningsStatus =
  | { earning: true; network: AdNetwork }
  | { earning: false; reason: "no-network" };

/**
 * The one question the game page asks. Today it always answers no, and the page
 * says so in words rather than showing a reward that will not arrive.
 */
export function earningsStatus(): EarningsStatus {
  const live = (Object.keys(REWARDED_SPECS) as AdNetwork[]).find(
    (network) => REWARDED_SPECS[network].confirmed,
  );
  return live ? { earning: true, network: live } : { earning: false, reason: "no-network" };
}

export function canEarnFromGames(): boolean {
  return earningsStatus().earning;
}
