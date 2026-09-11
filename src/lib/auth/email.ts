import { createTransport } from "nodemailer";
import { BRAND } from "@/lib/brand";
import { serverEnv } from "@/lib/env";
import { formatOtpForDisplay, OTP_TTL_SECONDS } from "@/lib/auth/otp";
import { addressProblem, UnsendableAddressError } from "@/lib/auth/address";
import { PROBLEM_DETAIL, redactTransport, transportProblem } from "@/lib/auth/transport";

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
    <!-- Wordmark only, no logo. Gmail strips inline SVG, and a hosted PNG
         would need an absolute URL that only exists once the site is
         deployed. Revisit after the VPS is live. -->
    <p style="font-size:15px;font-weight:600;letter-spacing:-.03em;margin:0 0 28px">${BRAND.name}</p>
    <p style="font-size:14px;color:#9C9E9C;margin:0 0 14px">Your sign-in code:</p>
    <p style="font-family:ui-monospace,monospace;font-size:34px;font-weight:600;letter-spacing:.12em;margin:0 0 18px">${formatOtpForDisplay(code)}</p>
    <p style="font-size:13px;color:#9C9E9C;line-height:1.6;margin:0 0 8px">It expires in ${minutes} minutes and can be used once.</p>
    <p style="font-size:13px;color:#6A6D6B;line-height:1.6;margin:0">If you did not ask to sign in, ignore this email. Nobody can use the code without also having access to this inbox.</p>
    <p style="font-size:12px;color:#434645;margin:28px 0 0">${BRAND.name} · ${BRAND.supportEmail}</p>
  </div>
</body></html>`;
}

export class EmailTransportMissingError extends Error {
  override name = "EmailTransportMissingError";

  constructor(detail: string) {
    super(`Sign-in codes cannot be sent. ${detail}`);
  }
}

/**
 * Whether sign-in can work at all right now. Read by the sign-in page.
 *
 * Checks the SHAPE of the connection string, not merely that it is non-empty —
 * see lib/auth/transport.ts for why that distinction is load-bearing.
 */
export function emailTransportConfigured(): boolean {
  return transportProblem(serverEnv().EMAIL_SERVER) === null;
}

/** The specific reason, for the health check and the server log. */
export function emailTransportDetail(): string | null {
  const problem = transportProblem(serverEnv().EMAIL_SERVER);
  return problem === null ? null : PROBLEM_DETAIL[problem];
}

/**
 * Opens the connection and authenticates, without sending anything.
 *
 * The shape check cannot tell a right password from a wrong one. This can, and
 * it is what /api/health reports — so a broken mail setup shows up on a deploy
 * rather than on the first person who tries to sign in.
 */
export async function verifyEmailTransport(): Promise<{ ok: true } | { ok: false; error: string }> {
  const env = serverEnv();
  const detail = emailTransportDetail();
  if (detail) return { ok: false, error: detail };

  try {
    const transport = createTransport(env.EMAIL_SERVER);
    await transport.verify();
    transport.close();
    return { ok: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown";
    // The redacted URL is included because the usual cause is the wrong host or
    // port, and knowing which one was tried saves a round of guessing.
    return { ok: false, error: `${message} (${redactTransport(env.EMAIL_SERVER)})` };
  }
}

/**
 * Sends the sign-in code.
 *
 * With no usable EMAIL_SERVER the code goes to the server log so the flow stays
 * testable without SMTP — in development only. In production the same situation
 * throws, because that log line is a credential.
 */
export async function sendSignInCode({ to, code }: SignInEmail): Promise<void> {
  const env = serverEnv();

  // Before anything else, including the development log line. The transport we
  // are pinned to has open parsing advisories, and this is the last point where
  // an address can be refused rather than parsed. See lib/auth/address.ts.
  const badAddress = addressProblem(to);
  if (badAddress) throw new UnsendableAddressError(badAddress);

  const badTransport = emailTransportDetail();
  if (badTransport) {
    // The code is a credential. Printing it to a production log would let
    // anyone who can read /var/log sign in as anyone — so refuse instead.
    // Sign-in fails visibly; the rest of the site is unaffected.
    if (env.NODE_ENV === "production") {
      throw new EmailTransportMissingError(badTransport);
    }

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
