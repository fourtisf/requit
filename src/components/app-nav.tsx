import Link from "next/link";
import { signOut } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/history", label: "History" },
  { href: "/referrals", label: "Referrals" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" },
] as const;

export function AppNav({ current }: { current: string }) {
  return (
    <header className="mb-10 flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-bd pb-4">
      <BrandLockup href="/dashboard" />

      <nav className="flex flex-wrap gap-0.5">
        {LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current === link.href ? "page" : undefined}
            className={
              current === link.href
                ? "rounded-lg bg-surf-2 px-[13px] py-[7px] text-[13.5px] text-fg"
                : "rounded-lg px-[13px] py-[7px] text-[13.5px] text-fg-3 transition-colors hover:bg-surf-2 hover:text-fg"
            }
          >
            {link.label}
          </Link>
        ))}
      </nav>

      <form
        className="ml-auto"
        action={async () => {
          "use server";
          await signOut({ redirectTo: "/" });
        }}
      >
        <button type="submit" className="text-[12.5px] text-fg-3 transition-colors hover:text-fg">
          Sign out
        </button>
      </form>
    </header>
  );
}
