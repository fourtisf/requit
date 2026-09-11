import type { Network } from "@prisma/client";

/**
 * Per-network credentials and the IP allowlist, read from the environment.
 *
 * Not part of `serverEnv()`: a missing Torox secret must not stop the app from
 * booting and paying people. It stops Torox postbacks, and nothing else.
 */
export type NetworkConfig = {
  secret: string;
  /** Postback source IPs, from the network's dashboard. */
  allowedIps: readonly string[];
};

const ENV_KEYS: Record<Network, { secret: string; ips: string }> = {
  CPX: { secret: "CPX_SECRET", ips: "CPX_POSTBACK_IPS" },
  LOOTABLY: { secret: "LOOTABLY_API_KEY", ips: "LOOTABLY_POSTBACK_IPS" },
  TIMEWALL: { secret: "TIMEWALL_SECRET", ips: "TIMEWALL_POSTBACK_IPS" },
  TOROX: { secret: "TOROX_SECRET", ips: "TOROX_POSTBACK_IPS" },
};

export function networkConfig(network: Network): NetworkConfig {
  const keys = ENV_KEYS[network];
  return {
    secret: process.env[keys.secret] ?? "",
    allowedIps: (process.env[keys.ips] ?? "")
      .split(",")
      .map((ip) => ip.trim())
      .filter(Boolean),
  };
}

export type IpDecision = "allowed" | "denied" | "no-allowlist";

/**
 * An empty allowlist denies everything. The alternative — treating "not
 * configured" as "allow all" — turns a forgotten environment variable into an
 * open endpoint that credits rewards to anyone who can guess a user id.
 */
export function checkIp(clientIp: string | null, allowed: readonly string[]): IpDecision {
  if (allowed.length === 0) return "no-allowlist";
  if (!clientIp) return "denied";
  return allowed.includes(clientIp) ? "allowed" : "denied";
}
