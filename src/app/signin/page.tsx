import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SignInForm } from "@/components/signin-form";
import { emailTransportConfigured, emailTransportDetail } from "@/lib/auth/email";
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

        <h1 className="mt-7 text-[27px] font-semibold leading-tight tracking-[-0.042em]">
          Sign in
        </h1>
        <p className="mt-2.5 text-[13.5px] leading-[1.6] text-fg-2">
          No password. We email you a code each time — there is nothing stored that can leak.
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
