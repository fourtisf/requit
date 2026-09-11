import type { Network } from "@prisma/client";

/**
 * The click that sends a member to the offer.
 *
 * Every network tracks a publisher's users through one query parameter on the
 * click URL — the "sub id". Whatever comes back on the postback is that value,
 * so if it is missing or wrong, the member does the work and the conversion
 * arrives attached to nobody. Nothing recovers it afterwards: the network has
 * no record that the person was ours.
 *
 * That makes this the same class of thing as the signature spec in spec.ts, and
 * it gets the same treatment. The parameter name is written here in the shape
 * each network is known to use, `confirmed` stays false until a person has
 * checked it against that network's own integration doc, and an unconfirmed
 * spec refuses the handoff rather than sending someone out on a link that may
 * not carry them.
 *
 * Refusing looks worse than it is. A member who cannot start a task is annoyed
 * for a minute. A member who plays a game for a week and is told the network
 * has no record of them is gone, and is right to be.
 */
export type SubIdSpec = {
  /** Query parameter the network reads as our member identifier. */
  param: string;
  /**
   * Flip to true only after checking this against the network's publisher
   * dashboard, and confirm with their test click that the value comes back on
   * the postback.
   */
  confirmed: boolean;
};

export const SUBID_SPECS: Record<Network, SubIdSpec> = {
  CPX: { param: "ext_user_id", confirmed: false },
  LOOTABLY: { param: "subId", confirmed: false },
  TIMEWALL: { param: "userID", confirmed: false },
  TOROX: { param: "user_id", confirmed: false },
};

export type HandoffFailure =
  /** The feed gave us no click URL for this offer. */
  | "no-url"
  /** Nobody has confirmed how this network reads our member id. */
  | "unconfirmed-spec"
  /** Not a URL, or not https. */
  | "bad-url";

export type Handoff = { ok: true; url: string } | { ok: false; reason: HandoffFailure };

export const HANDOFF_DETAIL: Record<HandoffFailure, string> = {
  "no-url": "This task has no link yet.",
  "unconfirmed-spec": "This network is not connected yet.",
  "bad-url": "This task's link is not usable.",
};

/**
 * True when a click would actually carry the member's identity. Used to render
 * the button as unavailable rather than letting someone click into a bounce.
 */
export function canHandOff(network: Network, trackingUrl: string | null): boolean {
  return buildHandoff({ network, trackingUrl, userId: "probe" }).ok;
}

export function buildHandoff(input: {
  network: Network;
  trackingUrl: string | null;
  userId: string;
}): Handoff {
  return withSpec(SUBID_SPECS[input.network], input.trackingUrl, input.userId);
}

/**
 * The whole rule, against a spec passed in rather than looked up.
 *
 * Split out so the tests can exercise a confirmed spec without reaching into
 * the shipped table and mutating it — a test that edits module state to make
 * itself pass is one restructure away from silently testing nothing.
 */
export function withSpec(spec: SubIdSpec, trackingUrl: string | null, userId: string): Handoff {
  if (!trackingUrl) return { ok: false, reason: "no-url" };
  if (!spec.confirmed) return { ok: false, reason: "unconfirmed-spec" };

  let url: URL;
  try {
    url = new URL(trackingUrl);
  } catch {
    return { ok: false, reason: "bad-url" };
  }

  // http would put the member id in cleartext across whatever network they are
  // on, and every one of these networks serves https.
  if (url.protocol !== "https:") return { ok: false, reason: "bad-url" };

  // set, not append: a feed URL sometimes arrives with the placeholder already
  // in it, and two copies of the parameter is a coin flip over which one the
  // network reads.
  url.searchParams.set(spec.param, userId);
  return { ok: true, url: url.toString() };
}
