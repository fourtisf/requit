import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { BRAND } from "@/lib/brand";
import { SignInForm } from "@/components/signin-form";

export const metadata = { title: "Sign in" };

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="shell flex min-h-dvh items-center justify-center py-20">
      <div className="w-full max-w-[380px]">
        <div className="flex items-center gap-[9px] text-[15px] font-semibold tracking-[-0.03em]">
          <span className="size-[19px] shrink-0 rounded-[5.5px] bg-[linear-gradient(148deg,#fff,#A9E7CD_58%,#3E9878)] shadow-[0_0_14px_rgba(107,203,165,.36)]" />
          {BRAND.name}
        </div>

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
