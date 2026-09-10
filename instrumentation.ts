/**
 * Next.js instrumentation hook. Runs once per server runtime at boot.
 * See src/lib/observability.ts — a no-op when SENTRY_DSN is unset.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { initSentry } = await import("@/lib/observability");
    initSentry();
  }
}

export async function onRequestError(
  ...args: Parameters<
    NonNullable<typeof import("@sentry/nextjs").captureRequestError>
  >
): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  if (!process.env.SENTRY_DSN) return;

  const { captureRequestError } = await import("@sentry/nextjs");
  captureRequestError(...args);
}
