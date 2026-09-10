import * as Sentry from "@sentry/nextjs";
import { serverEnv } from "@/lib/env";

/**
 * Sentry initialisation shared by the Next runtimes and the worker process.
 *
 * With no DSN this is a no-op, so development and CI carry no reporting client
 * and nothing is sent anywhere.
 */
export function initSentry(): void {
  const env = serverEnv();
  if (!env.SENTRY_DSN) return;

  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    tracesSampleRate: env.NODE_ENV === "production" ? 0.1 : 0,

    // This product handles money and identity. Nothing that identifies a person
    // should reach a third-party error tracker by default.
    sendDefaultPii: false,

    beforeSend(event) {
      if (event.request?.cookies) delete event.request.cookies;
      if (event.request?.headers) {
        delete event.request.headers.cookie;
        delete event.request.headers.authorization;
      }
      // Sign-in codes and wallet addresses travel in query strings.
      if (event.request?.query_string) delete event.request.query_string;
      return event;
    },
  });
}

export { Sentry };
