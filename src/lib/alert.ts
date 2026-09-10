import { serverEnv } from "@/lib/env";

export type AlertSeverity = "warn" | "critical";

type AlertInput = {
  severity: AlertSeverity;
  title: string;
  detail?: string;
  /** Structured context. Never put secrets or a user's email in here. */
  context?: Record<string, string | number | boolean | null>;
};

/**
 * Out-of-band alerting (HANDOFF.md §1: "Sentry + a Telegram alert bot").
 *
 * Alerting must never take the caller down with it — a payout worker that
 * crashes because Telegram is unreachable is worse than a missed alert. Every
 * path here swallows its own failure after logging it.
 *
 * With no bot configured this degrades to a log line, which is the correct
 * behaviour in development and in CI.
 */
export async function alert({ severity, title, detail, context }: AlertInput): Promise<void> {
  const line = [
    `[alert:${severity}] ${title}`,
    detail,
    context ? JSON.stringify(context) : undefined,
  ]
    .filter(Boolean)
    .join(" — ");

  if (severity === "critical") {
    console.error(line);
  } else {
    console.warn(line);
  }

  const env = serverEnv();
  const token = env.TELEGRAM_ALERT_BOT_TOKEN;
  const chatId = env.TELEGRAM_ALERT_CHAT_ID;
  if (!token || !chatId) return;

  const icon = severity === "critical" ? "🔴" : "🟠";
  const body = [
    `${icon} *${escapeMarkdown(title)}*`,
    detail ? escapeMarkdown(detail) : undefined,
    context
      ? Object.entries(context)
          .map(([key, value]) => `${escapeMarkdown(key)}: \`${escapeMarkdown(String(value))}\``)
          .join("\n")
      : undefined,
  ]
    .filter(Boolean)
    .join("\n\n");

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: body, parse_mode: "MarkdownV2" }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      console.error(`[alert] Telegram rejected the message: ${response.status}`);
    }
  } catch (error) {
    console.error("[alert] Telegram delivery failed:", error);
  }
}

/** Telegram's MarkdownV2 rejects a message containing any unescaped reserved char. */
function escapeMarkdown(value: string): string {
  return value.replace(/[_*[\]()~`>#+\-=|{}.!\\]/g, (char) => `\\${char}`);
}
