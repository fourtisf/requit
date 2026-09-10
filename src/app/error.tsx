"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { MessagePage } from "@/components/ui/message-page";
import { BRAND } from "@/lib/brand";

/**
 * Route-level error boundary. `digest` is the server-side error id — quoting it
 * in a support email is what lets us find the actual exception, since the
 * message itself is withheld from the client in production.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    void import("@sentry/nextjs").then(({ captureException }) => captureException(error));
  }, [error]);

  return (
    <MessagePage
      title="Something broke on our side"
      action={<Button onClick={reset}>Try again</Button>}
    >
      <p>
        This is our fault, not yours. Nothing you were doing has been lost — any balance and
        any task in progress are unaffected.
      </p>
      {error.digest ? (
        <p className="mt-3 text-fg-4">
          If it keeps happening, email {BRAND.supportEmail} and quote{" "}
          <span className="mn text-fg-3">{error.digest}</span>.
        </p>
      ) : null}
    </MessagePage>
  );
}
