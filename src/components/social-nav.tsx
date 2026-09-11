import Link from "next/link";
import { SOCIALS } from "@/lib/social";
import { SocialIcon } from "@/components/ui/social-icon";
import { cn } from "@/lib/cn";

/**
 * X and Telegram in the header, where people actually look for them.
 *
 * The pending branch is the interesting one. An icon that does nothing when
 * clicked is worse than no icon — it reads as a broken site — so while there is
 * no handle these point at #community, the block that says in words that we
 * have not opened the accounts yet and that anything using this name today is
 * not us. That is a real answer to the question the click was asking, and it is
 * the answer someone being messaged by a fake support account needs.
 *
 * They become ordinary external links the moment a URL is confirmed, with no
 * change here.
 */
export function SocialNav({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      {SOCIALS.map((social) =>
        social.url !== null ? (
          <a
            key={social.key}
            href={social.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={social.label}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-surf-2 hover:text-fg"
          >
            <SocialIcon name={social.key} size={14} />
          </a>
        ) : (
          <Link
            key={social.key}
            href="/#community"
            aria-label={`${social.label} — not open yet`}
            title={`${social.label} is not open yet`}
            className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-lg text-fg-4 transition-colors hover:bg-surf-2 hover:text-fg-2"
          >
            <SocialIcon name={social.key} size={14} />
          </Link>
        ),
      )}
    </div>
  );
}
