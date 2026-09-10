import { BRAND } from "@/lib/brand";
import { ButtonLink } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

/**
 * Phase 0 holding page.
 *
 * The full marketing site (proof table, country checker, SLA, changelog) is
 * Phase 4 — HANDOFF.md §10 — and every figure on it must be computed from live
 * data. Deliberately nothing quantitative here: there is no data to compute from
 * yet, and a placeholder number that ships is the one failure the positioning
 * cannot survive.
 */
export default function Home() {
  return (
    <main className="shell flex min-h-dvh flex-col justify-center py-24">
      <div className="max-w-[62ch]">
        <Badge accent="Phase 0">Scaffold</Badge>

        <h1 className="mt-8 text-[clamp(2.5rem,6.4vw,4.4rem)] font-semibold leading-[1.02] tracking-[-0.048em] text-balance">
          Advertiser-funded work.{" "}
          <span className="text-fg-3">Paid the same day.</span>
        </h1>

        <p className="mt-5 max-w-[54ch] text-[clamp(15px,1.55vw,17.5px)] font-light leading-[1.62] text-fg-2">
          Finish a task, the network confirms it, and {BRAND.name} pays you in USD or ETH.
          The public site goes live once there are real payouts to point at — until then
          this page stays empty rather than showing numbers nobody can check.
        </p>

        <div className="mt-8 flex flex-wrap gap-2.5">
          <ButtonLink href="/signin" size="lg">
            Sign in
          </ButtonLink>
        </div>

        <p className="mt-4 text-[12.5px] text-fg-4">
          Email code, no password. {BRAND.supportEmail}
        </p>
      </div>
    </main>
  );
}
