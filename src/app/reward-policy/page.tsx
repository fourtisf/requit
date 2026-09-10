import { LegalPage, Section, Callout } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL } from "@/lib/legal";
import { TIER_RULES } from "@/lib/risk";

export const metadata = {
  title: "Reward policy",
  description: `When ${BRAND.name} pays, when it does not, and what to do when something goes wrong.`,
};

/**
 * Operational policy — the rules this product actually runs on, written from
 * the code that enforces them. The hold windows come from TIER_RULES, the same
 * table the payout pipeline reads, so the page cannot drift from the behaviour.
 */
export default function RewardPolicyPage() {
  return (
    <LegalPage
      title="Reward policy"
      summary="When we pay, when we do not, and what happens when something goes wrong. This is the document to hold us to."
      effective={LEGAL.effective.rewards}
    >
      <Section id="what" heading="1. What a reward is">
        <p>
          Advertisers pay offer networks for verified actions — an install, a signup, a level
          reached. Those networks pay {BRAND.name}. We pass most of it to you and keep the rest.
        </p>
        <p>
          A reward is payment for completing every required milestone of a specific offer. It is
          not a wage, it is not guaranteed income, and it is not employment. If you complete
          nothing, you are owed nothing.
        </p>
      </Section>

      <Section id="shown" heading="2. What we show you before you start">
        <p>
          Reward, eligibility, deadline and any purchase requirement appear on screen before you
          open an offer. Never after.
        </p>
        <p>
          For offers that pay in tiers, we publish the completion rate for each tier — the share of
          people who started that reached it. It is computed from real traffic, never typed by
          hand. Below thirty samples we show nothing rather than a rate we cannot stand behind.
        </p>
        <Callout>
          Start an offer through our link. If you install the app or sign up some other way, the
          network cannot attribute your completion to you, and nobody — including us — can recover
          it afterwards.
        </Callout>
      </Section>

      <Section id="confirm" heading="3. When a reward is confirmed">
        <p>
          Payment releases when the offer network confirms your completion, not when a progress bar
          fills. That confirmation usually arrives in minutes and sometimes takes days, depending on
          the advertiser.
        </p>
        <p>
          A confirmed reward is first <b>pending</b>, then becomes <b>available</b> to withdraw once
          its hold has passed.
        </p>
      </Section>

      <Section id="holds" heading="4. Withdrawal holds">
        <p>
          New accounts hold longer, because reversals arrive after the fact and a reversal on money
          already sent is a loss we cannot recover. Holds shorten as an account builds a record.
        </p>
        <ul className="flex flex-col gap-2.5">
          {(["NEW", "STANDARD", "TRUSTED", "FLAGGED"] as const).map((tier) => (
            <li key={tier} className="flex flex-wrap gap-x-3 gap-y-1">
              <span className="mn min-w-[7rem] text-fg">{TIER_RULES[tier].label}</span>
              <span className="flex-1 text-fg-2">{TIER_RULES[tier].meaning}</span>
            </li>
          ))}
        </ul>
        <p>
          You move up by completing offers that stay confirmed. There is nothing to buy and nothing
          to apply for.
        </p>
      </Section>

      <Section id="reversals" heading="5. Reversals">
        <p>
          An offer network can reverse a confirmation after the fact — usually because the
          advertiser judged the action fraudulent or incomplete. When that happens the reward is
          marked reversed and removed from your balance.
        </p>
        <Callout>
          If a reversal lands after you have already withdrawn the money, we do not create a
          negative balance you can never clear, and we do not claw the payment back. We record it
          and review the account.
        </Callout>
        <p>
          Reversals stay visible in your history. A statement that quietly drops one is not a
          statement.
        </p>
      </Section>

      <Section id="purchase" heading="6. Offers that require a purchase">
        <p>
          Some offers require you to buy or subscribe to something. Those are labelled before you
          open them, with the amount.
        </p>
        <p>
          The purchase is between you and that advertiser. We do not refund it, we cannot cancel it
          for you, and the reward does not depend on whether you were happy with what you bought —
          only on whether the network confirms the action.
        </p>
      </Section>

      <Section id="withdrawing" heading="7. Withdrawing">
        <p>
          The minimum withdrawal is $10. Payouts go to a wallet you have verified by signature — we
          never ask for a seed phrase and never ask you to send a transaction to prove ownership.
        </p>
        <p>
          One wallet belongs to one account. If a wallet is already verified elsewhere, we will tell
          you rather than fail silently.
        </p>
        <Callout>
          On-chain payments cannot be undone. Check the address. A payout sent to an address you
          verified is final, and we cannot recover it.
        </Callout>
      </Section>

      <Section id="disputes" heading="8. When an offer does not track">
        <p>
          Open a dispute from your account. It gets a status you can see, and it moves: acknowledged,
          escalated to the network, awaiting their answer, resolved.
        </p>
        <p>
          We publish our real response times, computed from the last ninety days of disputes. We do
          not promise an outcome — much of the time the advertiser decides, not us — but you will
          always know where your dispute stands and what the answer was.
        </p>
        <p>
          Some disputes end in a refusal by the advertiser. When that happens we tell you it was
          refused and why, rather than letting it go quiet.
        </p>
      </Section>

      <Section id="void" heading="9. What voids a reward">
        <p>These end a reward, and repeated instances end the account:</p>
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-fg-4">
          <li>More than one account per person, per household device, or per wallet.</li>
          <li>Emulators, automation, or scripted completion of offers.</li>
          <li>False information given to an advertiser to pass their checks.</li>
          <li>Chargebacks or cancellations that reverse the action the reward paid for.</li>
        </ul>
        <p>
          Using a VPN is not itself a violation, but it raises the review level on an account,
          because offer networks treat masked traffic as higher risk.
        </p>
      </Section>

      <Section id="suspension" heading="10. Suspension and appeal">
        <p>
          If we suspend an account we tell you, on screen, with the reason. Tasks and withdrawals
          pause; the balance you have already earned stays yours.
        </p>
        <p>
          Every appeal is read by a person. If we got it wrong we say so and reinstate you. Email{" "}
          <span className="mn text-fg">{LEGAL.contactEmail}</span> from the address on the account.
        </p>
      </Section>

      <Section id="changes" heading="11. Changes">
        <p>
          We will change this policy as the product grows. The date at the top moves whenever it
          does. Changes are not applied retroactively to rewards already confirmed.
        </p>
      </Section>
    </LegalPage>
  );
}
