import { createTransport } from "nodemailer";
import { BRAND } from "@/lib/brand";
import { serverEnv } from "@/lib/env";
import { formatOtpForDisplay, OTP_TTL_SECONDS } from "@/lib/auth/otp";

type SignInEmail = {
  to: string;
  code: string;
};

function subject(): string {
  return `Your ${BRAND.name} sign-in code`;
}

function textBody(code: string): string {
  const minutes = Math.round(OTP_TTL_SECONDS / 60);
  return [
    `Your ${BRAND.name} sign-in code is ${formatOtpForDisplay(code)}`,
    "",
    `It expires in ${minutes} minutes and can be used once.`,
    "",
    `If you did not ask to sign in, ignore this email. Nobody can use the code`,
    `without also having access to this inbox.`,
    "",
    `${BRAND.name} · ${BRAND.supportEmail}`,
  ].join("\n");
}

function htmlBody(code: string): string {
  const minutes = Math.round(OTP_TTL_SECONDS / 60);
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#08090A;font-family:-apple-system,Segoe UI,system-ui,sans-serif;color:#FBFBFA">
  <div style="max-width:440px;margin:0 auto">
    <p style="font-size:15px;font-weight:600;letter-spacing:-.03em;margin:0 0 28px">${BRAND.name}</p>
    <p style="font-size:14px;color:#9C9E9C;margin:0 0 14px">Your sign-in code:</p>
    <p style="font-family:ui-monospace,monospace;font-size:34px;font-weight:600;letter-spacing:.12em;margin:0 0 18px">${formatOtpForDisplay(code)}</p>
    <p style="font-size:13px;color:#9C9E9C;line-height:1.6;margin:0 0 8px">It expires in ${minutes} minutes and can be used once.</p>
    <p style="font-size:13px;color:#6A6D6B;line-height:1.6;margin:0">If you did not ask to sign in, ignore this email. Nobody can use the code without also having access to this inbox.</p>
    <p style="font-size:12px;color:#434645;margin:28px 0 0">${BRAND.name} · ${BRAND.supportEmail}</p>
  </div>
</body></html>`;
}

/**
 * Sends the sign-in code.
 *
 * With no EMAIL_SERVER configured — local development only, `serverEnv()`
 * refuses to boot production without one — the code goes to the server log so
 * the flow stays testable without SMTP.
 */
export async function sendSignInCode({ to, code }: SignInEmail): Promise<void> {
  const env = serverEnv();

  if (env.EMAIL_SERVER === "") {
    console.info(`\n  [auth] sign-in code for ${to}: ${code}\n`);
    return;
  }

  const transport = createTransport(env.EMAIL_SERVER);
  const result = await transport.sendMail({
    to,
    from: env.EMAIL_FROM,
    subject: subject(),
    text: textBody(code),
    html: htmlBody(code),
  });

  const failed = [...(result.rejected ?? []), ...(result.pending ?? [])].filter(Boolean);
  if (failed.length > 0) {
    throw new Error(`Sign-in code to ${failed.join(", ")} could not be sent`);
  }
}
