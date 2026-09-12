import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SignInForm } from "@/components/signin-form";
import { emailTransportConfigured, emailTransportDetail } from "@/lib/auth/email";
import { OTP_LENGTH } from "@/lib/auth/otp";
import { serverEnv } from "@/lib/env";
import { BRAND } from "@/lib/brand";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="shell flex min-h-dvh items-center justify-center py-20">
      <div className="w-full max-w-[380px]">
        <BrandLockup />

        {/*
          The heading names both jobs because this page does both, and the
          landing page's button says "Create an account" while this said only
          "Sign in". Someone who has never been here reads that as a door that
          needs a key they were not given, and leaves — which is the one thing
          this page cannot afford, since it is the only way in.
        */}
        <h1 className="mt-7 text-[27px] font-semibold leading-tight tracking-[-0.042em]">
          Sign in or create an account
        </h1>
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-fg-2">
          One form for both. We email you a {OTP_LENGTH}-digit code — entering it signs you in, or
          opens your account if this is your first time.
        </p>
        <p className="mt-2 text-[12.5px] leading-[1.6] text-fg-4">
          No password anywhere, so there is none to steal and none for us to lose.
        </p>

        {emailTransportConfigured() ? (
          <SignInForm callbackUrl="/dashboard" />
        ) : (
          <div className="mt-7 rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3.5 shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]">
            <p className="text-[12.5px] leading-[1.55] text-amber">
              Sign-in is not available yet — we cannot send codes from this deployment. Nothing is
              wrong with your account. Try again shortly, or reach us at {BRAND.supportEmail}.
            </p>
            {/* The specific fault, to the operator only. A visitor cannot act on
                "no password in the connection string" and should not be shown
                the shape of our infrastructure. */}
            {serverEnv().NODE_ENV !== "production" ? (
              <p className="mn mt-2.5 text-[11.5px] leading-[1.5] text-fg-4">
                {emailTransportDetail()}
              </p>
            ) : null}
          </div>
        )}
      </div>
    </main>
  );
}
