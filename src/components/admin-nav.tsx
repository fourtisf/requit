import Link from "next/link";
import { cn } from "@/lib/cn";
import { BrandLockup } from "@/components/ui/brand-mark";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/withdrawals", label: "Withdrawals" },
  { href: "/admin/members", label: "Members" },
  { href: "/admin/audit", label: "Audit" },
] as const;

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="mb-8 flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-bd pb-4">
      <BrandLockup href="/dashboard" className="mr-2" />
      <span className="mn rounded-full bg-[rgba(232,198,139,.1)] px-[10px] py-[3px] text-[11px] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.24)]">
        operator
      </span>
      {LINKS.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={cn(
            "text-[13px] transition-colors",
            current === link.href ? "text-fg" : "text-fg-4 hover:text-fg-2",
          )}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
