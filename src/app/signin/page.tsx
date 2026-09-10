import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BrandLockup } from "@/components/ui/brand-mark";
import { SignInForm } from "@/components/signin-form";

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

        <SignInForm callbackUrl="/dashboard" />
      </div>
    </main>
  );
}
