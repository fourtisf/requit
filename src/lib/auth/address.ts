/**
 * What we are willing to hand to the mail transport.
 *
 * nodemailer 8.x carries advisories with no fixed release at the time of
 * writing (GHSA-2x7j-588g-ccc2, quadratic time in addressparser on a crafted
 * address list; GHSA-cc9r-2j5m-2m83 and GHSA-wmmp-3585-3rmp, recipient-domain
 * validation bypassed by RFC 5322 comments and by IDN/punycode confusion). We
 * cannot upgrade past it — it arrives under @auth/core, which pins it.
 *
 * All three need an address with structure: a list, a comment group, or a
 * non-ASCII domain. So the mitigation is not to parse more cleverly, it is to
 * refuse anything that has structure at all. One address, ASCII only, bounded
 * length, no syntax that addressparser could read as more than a single
 * mailbox. What gets through cannot express any of those attacks.
 *
 * This runs at the last point before the transport rather than at the form, so
 * a caller added later cannot route around it.
 */

/** RFC 5321 §4.5.3.1: the whole path, and the local part. */
const MAX_TOTAL = 254;
const MAX_LOCAL = 64;

export type AddressProblem =
  | "empty"
  | "too-long"
  | "non-ascii"
  | "has-structure"
  | "malformed";

/**
 * Characters that let addressparser see a list, a comment, a display name or a
 * group — the input shapes every one of the advisories needs. Whitespace is
 * included: a legitimate address that needs quoting to survive it is not one we
 * are willing to send to.
 */
const STRUCTURE = /[,;<>()[\]"\\:\s\u0000-\u001f]/;

const DOMAIN_LABEL = /^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$/;
const LOCAL_ALLOWED = /^[a-zA-Z0-9!#$%&'*+/=?^_`{|}~.-]+$/;

export function addressProblem(raw: string): AddressProblem | null {
  const address = raw.trim();

  if (address === "") return "empty";
  if (address.length > MAX_TOTAL) return "too-long";

  // Non-ASCII is what the punycode allow-list bypass is built on. Rejecting it
  // costs us genuine IDN addresses; the trade is deliberate and the user is
  // told, rather than having mail silently delivered somewhere else.
  if (/[^\x00-\x7f]/.test(address)) return "non-ascii";
  if (STRUCTURE.test(address)) return "has-structure";

  const at = address.lastIndexOf("@");
  if (at <= 0 || at === address.length - 1) return "malformed";

  const local = address.slice(0, at);
  const domain = address.slice(at + 1);

  // A second @ would make the mailbox ambiguous to a parser that splits on the
  // first one while we split on the last.
  if (local.includes("@")) return "malformed";

  if (local.length > MAX_LOCAL) return "too-long";
  if (!LOCAL_ALLOWED.test(local)) return "malformed";
  if (local.startsWith(".") || local.endsWith(".") || local.includes("..")) return "malformed";

  if (domain.length > 253) return "too-long";
  const labels = domain.split(".");
  if (labels.length < 2) return "malformed";
  if (!labels.every((label) => label.length >= 1 && label.length <= 63 && DOMAIN_LABEL.test(label))) {
    return "malformed";
  }

  // A numeric TLD is not deliverable and is a common shape in crafted inputs.
  const tld = labels[labels.length - 1] ?? "";
  if (!/^[a-zA-Z]{2,}$/.test(tld)) return "malformed";

  return null;
}

export function isSendableAddress(raw: string): boolean {
  return addressProblem(raw) === null;
}

export class UnsendableAddressError extends Error {
  override name = "UnsendableAddressError";
  readonly problem: AddressProblem;

  constructor(problem: AddressProblem) {
    super(`Refusing to send to an address that is ${problem}.`);
    this.problem = problem;
  }
}
