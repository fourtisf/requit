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
  NEXT_PUBLIC_APP_URL: z.url().default("http://localhost:3000"),
  EMAIL_SERVER: z.string().default(""),
  EMAIL_FROM: z.string().min(1).default(`${BRAND.name} <no-reply@${BRAND.domain}>`),
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

  // A production deployment with no mail transport cannot deliver sign-in codes,
  // which fails closed and silently. Fail loudly at boot instead.
  if (parsed.data.NODE_ENV === "production" && parsed.data.EMAIL_SERVER === "") {
    throw new Error("EMAIL_SERVER must be set in production — OTP delivery depends on it.");
  }

  cached = parsed.data;
  return cached;
}

/** Test seam. Not for application code. */
export function resetServerEnvCache(): void {
  cached = null;
}
