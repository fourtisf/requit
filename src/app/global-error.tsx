"use client";

import { useEffect } from "react";

/**
 * Catches failures in the root layout itself, which is the one case where the
 * normal error boundary cannot render — it lives inside that layout. Ships its
 * own <html>, so it cannot rely on the app's fonts or stylesheet either.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    void import("@sentry/nextjs").then(({ captureException }) => captureException(error));
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#08090A",
          color: "#FBFBFA",
          fontFamily: "-apple-system, Segoe UI, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "440px" }}>
          <h1 style={{ fontSize: "27px", fontWeight: 600, letterSpacing: "-0.042em", margin: 0 }}>
            Something broke on our side
          </h1>
          <p style={{ color: "#9C9E9C", fontSize: "13.5px", lineHeight: 1.6, marginTop: "10px" }}>
            Reload the page. If it keeps happening, quote this reference to support:{" "}
            <span style={{ color: "#6A6D6B" }}>{error.digest ?? "none"}</span>.
          </p>
        </div>
      </body>
    </html>
  );
}
