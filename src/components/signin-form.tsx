"use client";

import { useState, useTransition } from "react";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { isWellFormedOtp, OTP_LENGTH } from "@/lib/auth/otp";
import { cn } from "@/lib/cn";

const inputClass =
  "w-full rounded-soft bg-bg-2 px-[14px] py-3 text-[14.5px] text-fg placeholder:text-fg-4 " +
  "shadow-[inset_0_0_0_1px_var(--color-bd-2)] outline-none focus-visible:shadow-[inset_0_0_0_1px_var(--color-ac)]";

export function SignInForm({ callbackUrl }: { callbackUrl: string }) {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    startTransition(async () => {
      const result = await signIn("otp", { email, redirect: false, callbackUrl });

      // Auth.js reports a send failure — including our own rate limit — as an
      // error on the result rather than a throw.
      if (result?.error) {
        setError("We could not send a code just now. Wait a moment and try again.");
        return;
      }

      setSent(true);
    });
  }

  function submitCode(event: React.FormEvent) {
    event.preventDefault();

    if (!isWellFormedOtp(code)) {
      setError(`Enter the ${OTP_LENGTH} digits from the email.`);
      return;
    }

    // The code IS the Auth.js verification token, so verification is the normal
    // email callback. Building the URL here rather than mailing it means link
    // prefetchers in mail clients cannot consume the code before the user does.
    const url = new URL("/api/auth/callback/otp", window.location.origin);
    url.searchParams.set("token", code);
    url.searchParams.set("email", email);
    url.searchParams.set("callbackUrl", callbackUrl);
    window.location.href = url.toString();
  }

  if (!sent) {
    return (
      <form onSubmit={requestCode} className="mt-7 flex flex-col gap-3">
        <label htmlFor="email" className="text-[12.5px] text-fg-3">
          Email address
        </label>
        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          autoFocus
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className={inputClass}
        />
        <Button type="submit" size="lg" disabled={pending} className="mt-2 justify-center">
          {pending ? "Sending…" : "Email me a code"}
        </Button>
        <FormError message={error} />
      </form>
    );
  }

  return (
    <form onSubmit={submitCode} className="mt-7 flex flex-col gap-3">
      <p className="text-[13.5px] leading-[1.6] text-fg-2">
        We sent a {OTP_LENGTH}-digit code to <span className="text-fg">{email}</span>. It expires
        in ten minutes and works once.
      </p>
      <label htmlFor="code" className="mt-2 text-[12.5px] text-fg-3">
        Sign-in code
      </label>
      <input
        id="code"
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        required
        autoFocus
        placeholder="000000"
        value={code}
        onChange={(event) => setCode(event.target.value.replace(/\D/g, ""))}
        className={cn(inputClass, "mn text-center text-[22px] tracking-[0.32em]")}
      />
      <Button type="submit" size="lg" className="mt-2 justify-center">
        Sign in
      </Button>
      <button
        type="button"
        onClick={() => {
          setSent(false);
          setCode("");
          setError(null);
        }}
        className="mt-1 text-[12.5px] text-fg-3 transition-colors hover:text-fg"
      >
        Use a different address
      </button>
      <FormError message={error} />
    </form>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <p
      role="alert"
      className="rounded-soft bg-[rgba(232,198,139,.08)] px-[14px] py-3 text-[12.5px] leading-[1.5] text-amber shadow-[inset_0_0_0_1px_rgba(232,198,139,.2)]"
    >
      {message}
    </p>
  );
}
