import { liveSocials } from "@/lib/social";
import { SocialIcon } from "@/components/ui/social-icon";
import { cn } from "@/lib/cn";

/**
 * The accounts we tell people to trust.
 *
 * Renders nothing while no handle is configured. An absent link is a non-event;
 * a link to an account that is not ours is how people get drained by someone
 * impersonating us, so a placeholder is not an option here.
 */
export function SocialLinks({ className }: { className?: string }) {
  const socials = liveSocials();
  if (socials.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap items-center gap-1.5", className)}>
      {socials.map((social) => (
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
      ))}
    </div>
  );
}
