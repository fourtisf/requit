import { BRAND } from "@/lib/brand";
import { SOCIALS, pendingSocials } from "@/lib/social";
import { SocialLinks } from "@/components/social-links";

/**
 * The accounts we tell people to trust — and, while there are none, the fact
 * that there are none.
 *
 * The empty state is not a placeholder for something better. "We have not
 * opened any accounts yet, so nobody claiming to be us is us" is a stronger
 * statement than a link, and it is the one that is true today. The chips are
 * still shown, because a named account marked not-open is checkable and a blank
 * space is not.
 */
export function SocialCard() {
  const pending = pendingSocials();
  const allPending = pending.length === SOCIALS.length;

  return (
    <div className="rounded-card px-[18px] py-4 surface-inset">
      <p className="mn text-[12px] uppercase tracking-[0.08em] text-fg-4">Where we post</p>

      <SocialLinks className="mt-3" />

      <p className="mt-3 max-w-[42ch] text-[12.5px] leading-[1.6] text-fg-3">
        {allPending
          ? `${BRAND.name} has not opened these accounts yet, so any account using this name right now is not us. The handles appear here first.`
          : pending.length > 0
            ? "The linked accounts are the only ones we use. The rest are not open yet, so anything using this name is not us."
            : "These are the only accounts we use."}{" "}
        We will never message you first, and we will never ask for a seed phrase or a payment to
        release a withdrawal.
      </p>
    </div>
  );
}
