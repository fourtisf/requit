import { SOCIALS } from "@/lib/social";
import { SocialIcon } from "@/components/ui/social-icon";
import { cn } from "@/lib/cn";

/**
 * X and Telegram — linked once the handle is confirmed, named and inert until
 * then.
 *
 * The inert chip is not a placeholder waiting to be filled in. It carries a
 * claim that only works if it is made before the accounts exist: we have not
 * opened these, so anything using this name today is not us. Someone being
 * messaged by a fake @requit support account has, on this page, the one fact
 * that settles it.
 *
 * What it must never become is a link. A guessed handle points people at
 * whoever registered the name first, and that is the whole mechanism behind
 * every drained wallet in this category — so the pending branch renders a span
 * and PendingSocial pins url to null.
 */
export function SocialLinks({ className }: { className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {SOCIALS.map((social) =>
        social.url !== null ? (
          <a
            key={social.key}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="inline-flex items-center gap-2 rounded-full bg-surf px-[13px] py-[7px] text-[12.5px] text-fg-3 shadow-[inset_0_0_0_1px_var(--color-bd)] transition-colors hover:bg-surf-2 hover:text-fg"
          >
            <SocialIcon name={social.key} />
            {social.handle ?? social.label}
          </a>
        ) : (
          <span
            key={social.key}
            className="inline-flex items-center gap-2 rounded-full px-[13px] py-[7px] text-[12.5px] text-fg-4 shadow-[inset_0_0_0_1px_var(--color-bd)]"
          >
            <SocialIcon name={social.key} />
            {social.label}
            <span className="mn text-[11px] uppercase tracking-[0.07em] text-fg-4">Soon</span>
          </span>
        ),
      )}
    </div>
  );
}
