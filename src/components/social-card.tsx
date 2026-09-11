import { BRAND } from "@/lib/brand";
import { liveSocials } from "@/lib/social";
import { SocialLinks } from "@/components/social-links";

/**
 * The accounts we tell people to trust — and, while there are none, the fact
 * that there are none.
 *
 * The empty state is not a placeholder for something better. "We have not
 * announced any accounts yet, so nobody claiming to be us is us" is a stronger
 * statement than a link, and it is the one that is true today. A card that
 * rendered a heading over nothing would just look broken, and a project that
 * looks broken next to a ticker is the shape people have learned to distrust.
 */
export function SocialCard() {
  const socials = liveSocials();

  return (
    <div className="rounded-card px-[18px] py-4 surface-inset">
      <p className="mn text-[12px] uppercase tracking-[0.08em] text-fg-4">Where we post</p>

      {socials.length > 0 ? (
        <>
          <SocialLinks className="mt-3" />
          <p className="mt-3 max-w-[42ch] text-[12.5px] leading-[1.6] text-fg-3">
            These are the only accounts we use. We will never message you first, and we will never
            ask for a seed phrase or a payment to release a withdrawal.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] text-amber">No accounts announced yet</p>
          <p className="mt-2 max-w-[42ch] text-[12.5px] leading-[1.6] text-fg-3">
            {BRAND.name} has no X or Telegram account yet. Any account using this name right now
            is not us. When we open one, it will be linked here first.
          </p>
        </>
      )}
    </div>
  );
}
