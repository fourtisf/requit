import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";
import { Button } from "@/components/ui/button";
import { LegalConsent } from "@/components/legal-consent";
import { OTP_LENGTH, OTP_TTL_SECONDS } from "@/lib/auth/otp";

export const metadata = { title: "Enter your code" };

/**
 * The no-JavaScript path.
 *
 * With JS the whole flow stays on /signin and never lands here. Auth.js redirects
 * a plain form POST to /api/auth/verify-request, which forwards to this page, so
 * without it the sign-in flow dead-ends in a 404.
 *
 * The form is a plain GET to the callback URL — the same request the client form
 * builds — so it needs no client bundle at all.
 */
export default async function VerifyCodePage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  const minutes = Math.round(OTP_TTL_SECONDS / 60);

  return (
    <main className="shell flex min-h-dvh items-center justify-center py-20">
      <div className="w-full max-w-[380px]">
        <BrandLockup />

        <h1 className="mt-7 text-[27px] font-semibold leading-tight tracking-[-0.042em]">
          Check your email
        </h1>
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-fg-2">
          We sent you a {OTP_LENGTH}-digit code. It expires in {minutes} minutes and works once.
        </p>

        <form method="get" action="/api/auth/callback/otp" className="mt-7 flex flex-col gap-3">
          <input type="hidden" name="callbackUrl" value="/dashboard" />

          <label htmlFor="email" className="text-[12.5px] text-fg-3">
            Email address
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full rounded-soft bg-bg-2 px-[14px] py-3 text-[14.5px] text-fg placeholder:text-fg-4 shadow-[inset_0_0_0_1px_var(--color-bd-2)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ac)]"
          />

          <label htmlFor="token" className="mt-2 text-[12.5px] text-fg-3">
            Sign-in code
          </label>
          <input
            id="token"
            name="token"
            inputMode="numeric"
            pattern={`\\d{${OTP_LENGTH}}`}
            maxLength={OTP_LENGTH}
            required
            autoComplete="one-time-code"
            placeholder="000000"
            className="mn w-full rounded-soft bg-bg-2 px-[14px] py-3 text-center text-[22px] tracking-[0.32em] text-fg placeholder:text-fg-4 shadow-[inset_0_0_0_1px_var(--color-bd-2)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ac)]"
          />

          <Button type="submit" size="lg" className="mt-2 justify-center">
            Sign in
          </Button>
        </form>

        <LegalConsent className="mt-5 text-[12px] leading-[1.6] text-fg-4" />

        <a href="/signin" className="mt-5 block text-[12.5px] text-fg-3 transition-colors hover:text-fg">
          Start again
        </a>
      </div>
    </main>
  );
}
