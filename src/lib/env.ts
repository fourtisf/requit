import { z } from "zod";
import { BRAND } from "@/lib/brand";

/**
 * Server environment. Parsed once, lazily, so that importing a module in a unit
 * test does not require a full production environment.
 *
 * Phase 1+ variables (network secrets, RPC URLs, hot wallet keystore) are
 * deliberately absent: they are validated by the subsystem that needs them, at
 * the point it needs them. A missing Torox secret should not stop the app from
 * booting and paying out.
 */
const serverSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  REDIS_URL: z.string().min(1, "REDIS_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),

  // Canonical origin. Auth.js runs with `trustHost`, which is required behind
  // Cloudflare and Nginx but means the Host header decides the callback origin.
  // Setting this pins it instead, so a poisoned Host cannot redirect sign-in.
  AUTH_URL: z.url().optional(),

  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  EMAIL_SERVER: z.string().default(""),
  EMAIL_FROM: z.string().min(1).default(`${BRAND.name} <no-reply@${BRAND.domain}>`),

  // Mail transport. Optional at boot: the public site does not need it, so a
  // missing SMTP server must not stop the whole app from starting. Sign-in DOES
  // need it, and refuses to run without it — see sendSignInCode.
  // Ops. All optional — an unconfigured alert channel degrades to a log line
  // rather than stopping the process.
  SENTRY_DSN: z.string().default(""),
  TELEGRAM_ALERT_BOT_TOKEN: z.string().default(""),
  TELEGRAM_ALERT_CHAT_ID: z.string().default(""),
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | null = null;

export function serverEnv(): ServerEnv {
  if (cached) return cached;

  const parsed = serverSchema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `  ${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid server environment:\n${detail}`);
  }

  if (parsed.data.NODE_ENV === "production") {
    // Each of these fails silently or dangerously rather than loudly if it is
    // missing, so they are checked at boot instead of at first use.
    const missing: string[] = [];

    // Without this the Host header decides the auth origin. See AUTH_URL above.
    if (!parsed.data.AUTH_URL) missing.push("AUTH_URL (pins the auth origin behind the proxy)");

    if (missing.length > 0) {
      throw new Error(`Missing required production environment:\n  ${missing.join("\n  ")}`);
    }
  }

  cached = parsed.data;
  return cached;
}

/** Test seam. Not for application code. */
export function resetServerEnvCache(): void {
  cached = null;
}
