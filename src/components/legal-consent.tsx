import Link from "next/link";
import { LEGAL } from "@/lib/legal";

/**
 * The line that has to be on the screen where an account is created.
 *
 * Terms and Privacy were linked from the site footer only — and /signin has no
 * footer, so until now somebody could open an account having been shown neither.
 * For a service that will hold a payout address that is a gap in the paperwork
 * as much as in the interface: every offer network's publisher review looks for
 * exactly this line, and every legitimate service a visitor has used before has
 * one. Its absence is noticed even when its presence is not.
 *
 * No checkbox. A checkbox on a one-field form is friction that changes nobody's
 * mind, and the consent it records is no stronger than continuing.
 *
 * Which VERSION was agreed to is not stored either, and does not need to be:
 * the policies carry effective dates (LEGAL.effective) and the account carries
 * createdAt, so the terms in force when somebody signed up are the ones dated
 * on or before that day. A column would be a second copy of a fact we already
 * have, and a second copy is a thing that can disagree.
 */
export function LegalConsent({ className }: { className?: string }) {
  return (
    <p className={className}>
      By continuing you agree to our{" "}
      <Link href="/terms" className="text-fg-3 underline underline-offset-4 hover:text-fg">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="text-fg-3 underline underline-offset-4 hover:text-fg">
        Privacy Policy
      </Link>
      , last updated {LEGAL.effective.terms}.
    </p>
  );
}
