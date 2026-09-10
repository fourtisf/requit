import { prisma } from "@/lib/prisma";
import { MessagePage } from "@/components/ui/message-page";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "Email preferences" };
export const dynamic = "force-dynamic";

/**
 * One-click unsubscribe from an email link.
 *
 * Deliberately requires no sign-in: someone who wants the email to stop should
 * not have to find a password they never had. The token is the authorisation,
 * and it can only ever do this one thing — turn every notification off for the
 * account it belongs to. Sign-in codes are unaffected; they are the credential,
 * not a notification.
 */
export default async function UnsubscribePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const result = await prisma.user.updateMany({
    where: { unsubscribeToken: token },
    data: { notifyRewards: false, notifyWithdrawals: false, notifyDisputes: false },
  });

  // updateMany rather than update, so an unknown token is 0 rows instead of an
  // exception — and the page below never reveals whether the token was real.
  const changed = result.count > 0;

  return (
    <MessagePage
      title={changed ? "Emails stopped" : "That link has expired"}
      action={<ButtonLink href="/settings">Open settings</ButtonLink>}
    >
      {changed ? (
        <p>
          You will not get notification emails from us again. Sign-in codes still arrive — they
          are how you get into your account. You can turn individual notifications back on in
          settings at any time.
        </p>
      ) : (
        <p>
          We could not match this link, so nothing was changed. Open settings to manage your email
          preferences directly.
        </p>
      )}
    </MessagePage>
  );
}
