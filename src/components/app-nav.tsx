import Link from "next/link";
import { signOut } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";
import { viewerIsAdmin } from "@/lib/admin/access";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/tasks", label: "Tasks" },
  { href: "/withdraw", label: "Withdraw" },
  { href: "/disputes", label: "Disputes" },
  { href: "/history", label: "History" },
  { href: "/referrals", label: "Referrals" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/settings", label: "Settings" },
] as const;

export async function AppNav({ current }: { current: string }) {
  const isAdmin = await viewerIsAdmin();

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

      {isAdmin ? (
        <Link
          href="/admin"
          className="mn ml-auto rounded-full bg-[rgba(232,198,139,.1)] px-[11px] py-1 text-[11.5px] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.24)] transition-colors hover:bg-[rgba(232,198,139,.16)]"
        >
          operator
        </Link>
      ) : null}

      <form
        className={isAdmin ? "" : "ml-auto"}
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
