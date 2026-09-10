import { redirect } from "next/navigation";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { BRAND } from "@/lib/brand";
import { BrandLockup } from "@/components/ui/brand-mark";
import { Card } from "@/components/ui/card";

export const metadata = { title: "Account suspended" };

/**
 * HANDOFF.md §7: "do not ban silently. A flagged user sees a clear message and a
 * route to appeal."
 *
 * This page calls `auth()` rather than `requireUser()` — `requireUser()` redirects
 * here, so using it would loop.
 */
export default async function SuspendedPage() {
  const session = await auth();
  if (!session?.user) redirect("/signin");
  if (!session.user.suspended) redirect("/dashboard");

  // Neither the date nor the reason is carried in the session: the reason is
  // operator-written text read only on this page, and a Date does not survive
  // the session's JSON round trip as a Date.
  const record = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { suspendedAt: true, suspendReason: true },
  });

  const suspendedOn = record?.suspendedAt?.toISOString().slice(0, 10);
  const subject = encodeURIComponent(`Appeal — ${session.user.handle}`);

  return (
    <main className="shell flex min-h-dvh items-center justify-center py-20">
      <div className="w-full max-w-[520px]">
        <BrandLockup />

        <h1 className="mt-7 text-[27px] font-semibold leading-tight tracking-[-0.042em]">
          Your account is suspended
        </h1>
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-fg-2">
          {suspendedOn ? `Suspended on ${suspendedOn}. ` : ""}Tasks and withdrawals are paused
          while this is open. Any balance you have already earned stays yours.
        </p>

        <Card className="mt-6" tone="inset">
          <p className="text-[12.5px] text-fg-4">Reason given</p>
          <p className="mt-2 text-[13.5px] leading-[1.6] text-fg">
            {record?.suspendReason ?? "No reason was recorded. Ask us and we will tell you."}
          </p>
        </Card>

        <div className="mt-6">
          <p className="text-[13.5px] font-medium">How to appeal</p>
          <p className="mt-2 max-w-[62ch] text-[13.5px] font-light leading-[1.65] text-fg-2">
            Email us from the address on this account and quote your handle,{" "}
            <span className="mn text-fg">{session.user.handle}</span>. A person reads every
            appeal. If we got this wrong we say so and reinstate you.
          </p>
          <a
            href={`mailto:${BRAND.supportEmail}?subject=${subject}`}
            className="mn mt-3 inline-block text-[13.5px] text-ac-2 underline underline-offset-4"
          >
            {BRAND.supportEmail}
          </a>
        </div>

        <form
          className="mt-8"
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button
            type="submit"
            className="text-[12.5px] text-fg-3 transition-colors hover:text-fg"
          >
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
