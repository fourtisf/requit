import { createTransport } from "nodemailer";
import { BRAND } from "@/lib/brand";
import { serverEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

/**
 * Notification email.
 *
 * Distinct from the sign-in code, which is transactional: that one is the
 * account's only credential and is never suppressed by a preference or an
 * unsubscribe. Everything routed through here is suppressible, and every message
 * carries a working unsubscribe link — required by CAN-SPAM and the GDPR
 * regimes the country checker's own list puts us in.
 *
 * The events below do not fire yet. Rewards land in Phase 1 and withdrawals in
 * Phase 2; this is the plumbing they call, built now because the preference and
 * unsubscribe surfaces are what a member needs on day one.
 */
export type NotificationKind = "reward" | "withdrawal" | "dispute";

const PREFERENCE_COLUMN = {
  reward: "notifyRewards",
  withdrawal: "notifyWithdrawals",
  dispute: "notifyDisputes",
} as const satisfies Record<NotificationKind, string>;

export type Notification = {
  userId: string;
  kind: NotificationKind;
  subject: string;
  body: string;
};

export type NotifyResult =
  | { sent: true }
  | { sent: false; reason: "opted-out" | "no-user" | "suspended" };

export async function notify(notification: Notification): Promise<NotifyResult> {
  const user = await prisma.user.findUnique({
    where: { id: notification.userId },
    select: {
      email: true,
      suspendedAt: true,
      unsubscribeToken: true,
      notifyRewards: true,
      notifyWithdrawals: true,
      notifyDisputes: true,
    },
  });

  if (!user) return { sent: false, reason: "no-user" };

  const column = PREFERENCE_COLUMN[notification.kind];
  if (!user[column]) return { sent: false, reason: "opted-out" };

  await deliver({
    to: user.email,
    subject: notification.subject,
    body: notification.body,
    unsubscribeToken: user.unsubscribeToken,
  });

  return { sent: true };
}

type Delivery = {
  to: string;
  subject: string;
  body: string;
  unsubscribeToken: string;
};

async function deliver({ to, subject, body, unsubscribeToken }: Delivery): Promise<void> {
  const env = serverEnv();
  const unsubscribeUrl = `${env.NEXT_PUBLIC_APP_URL}/unsubscribe/${unsubscribeToken}`;

  if (env.EMAIL_SERVER === "") {
    // Not a credential, so logging it is only a development convenience. In
    // production, say nothing was sent rather than pretending it was.
    if (env.NODE_ENV === "production") {
      throw new Error("EMAIL_SERVER is not set, so notifications cannot be sent.");
    }

    console.info(`\n  [notify] to ${to}: ${subject}\n  ${body}\n`);
    return;
  }

  const transport = createTransport(env.EMAIL_SERVER);
  await transport.sendMail({
    to,
    from: env.EMAIL_FROM,
    subject,
    text: `${body}\n\n—\nStop these emails: ${unsubscribeUrl}`,
    html: htmlBody(body, unsubscribeUrl),
    headers: {
      // Lets a mail client offer one-click unsubscribe without the user having
      // to find the link. Mailbox providers weigh its absence against sender
      // reputation, and this product cannot afford to land in spam: a member
      // who never sees "your withdrawal settled" assumes they were not paid.
      "List-Unsubscribe": `<${unsubscribeUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });
}

function htmlBody(body: string, unsubscribeUrl: string): string {
  return `<!doctype html>
<html><body style="margin:0;padding:32px 16px;background:#08090A;font-family:-apple-system,Segoe UI,system-ui,sans-serif;color:#FBFBFA">
  <div style="max-width:440px;margin:0 auto">
    <!-- Wordmark only, no logo. Gmail strips inline SVG, and a hosted PNG
         would need an absolute URL that only exists once the site is
         deployed. Revisit after the VPS is live. -->
    <p style="font-size:15px;font-weight:600;letter-spacing:-.03em;margin:0 0 24px">${BRAND.name}</p>
    <p style="font-size:14px;line-height:1.65;color:#9C9E9C;margin:0">${escapeHtml(body)}</p>
    <p style="font-size:12px;color:#434645;margin:28px 0 0">
      <a href="${unsubscribeUrl}" style="color:#6A6D6B">Stop these emails</a>
    </p>
  </div>
</body></html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
