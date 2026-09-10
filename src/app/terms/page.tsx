import Link from "next/link";
import { LegalPage, Section, Callout } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL, operatorName } from "@/lib/legal";

export const metadata = {
  title: "Terms",
  description: `The agreement between you and ${BRAND.name}.`,
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      summary={`The agreement between you and ${operatorName()}. Plain words, because terms nobody reads protect nobody.`}
      effective={LEGAL.effective.terms}
    >
      <Section id="agreement" heading="1. This agreement">
        <p>
          By creating an account or using {BRAND.name} you agree to these terms, to the{" "}
          <Link href="/reward-policy" className="text-ac-2 underline underline-offset-2">
            Reward policy
          </Link>{" "}
          and to the{" "}
          <Link href="/privacy" className="text-ac-2 underline underline-offset-2">
            Privacy notice
          </Link>
          . If you do not agree, do not use the service.
        </p>
      </Section>

      <Section id="eligibility" heading="2. Who can use it">
        <p>
          You must be at least 18. Some offers carry their own age or location restrictions set by
          the advertiser, and those apply on top of ours.
        </p>
        <p>
          One person, one account. One wallet belongs to one account and cannot be moved to another.
        </p>
        <p>
          You may not use the service if sanctions or the law where you are prohibit it.
        </p>
      </Section>

      <Section id="account" heading="3. Your account">
        <p>
          Sign-in is a code sent to your email — there is no password. Whoever controls that inbox
          controls the account, so keep it secure. Tell us immediately if you lose access to it.
        </p>
        <p>Give accurate information. An account opened with false details can be closed.</p>
      </Section>

      <Section id="rewards" heading="4. Rewards and payment">
        <p>
          What you earn, when it is confirmed, what voids it and how withdrawals work are set out in
          the{" "}
          <Link href="/reward-policy" className="text-ac-2 underline underline-offset-2">
            Reward policy
          </Link>
          , which forms part of these terms.
        </p>
        <p>
          A reward is payment for completing an offer. It is not a wage. Nothing here creates
          employment, partnership, or agency between us — you choose what to do and when, and we
          owe you nothing until an offer network confirms a completion.
        </p>
        <Callout>
          Payouts settle on a public blockchain and cannot be reversed. A payment sent to an address
          you verified is final, and neither we nor anyone else can recover it.
        </Callout>
      </Section>

      <Section id="conduct" heading="5. What you may not do">
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-fg-4">
          <li>Hold more than one account, or complete offers on behalf of someone else.</li>
          <li>Use emulators, bots, scripts, or automation to complete offers.</li>
          <li>Give an advertiser false information to pass their verification.</li>
          <li>Interfere with the service, or try to reach parts of it you were not given access to.</li>
          <li>Resell or redistribute what you find here, including offer data.</li>
        </ul>
      </Section>

      <Section id="third-party" heading="6. Offer providers and advertisers">
        <p>
          Offers come from independent networks — CPX Research, Lootably, TimeWall and Torox — and
          from the advertisers behind them. They are not our sponsors, our partners in your task, or
          our employees, and we do not control what they do.
        </p>
        <p>
          Whether a completion counts is their decision. We pass on what they tell us, dispute it on
          your behalf where we can, and publish how often that succeeds. We cannot overrule them.
        </p>
        <p>
          Anything you buy in an offer that requires a purchase is a contract between you and that
          advertiser. Refunds, cancellations and complaints about it go to them.
        </p>
      </Section>

      <Section id="suspension" heading="7. Suspension and closing an account">
        <p>
          We may suspend an account that breaks these terms or shows the fraud patterns described in
          the Reward policy. If we do, we say so on screen, with the reason, and a person reads every
          appeal.
        </p>
        <p>
          A balance already earned stays yours. You can close your account at any time by emailing
          us.
        </p>
      </Section>

      <Section id="availability" heading="8. Availability">
        <p>
          We do not promise the service is always available. Offer inventory changes constantly,
          depends on the networks, and may be empty in your country.
        </p>
        <p>
          {BRAND.ticker} is not offered or sold through this service, and nothing here is an offer
          of a security or an investment.
        </p>
      </Section>

      <Section id="liability" heading="9. Disclaimers and liability">
        <p>
          The service is provided as it is. We do not warrant that offers will track, that
          advertisers will approve them, or that any amount will be earned.
        </p>
        <p>
          To the extent the law allows, our liability to you is limited to the balance owed to your
          account at the time the claim arose. Nothing in these terms limits liability that cannot
          be limited by law.
        </p>
      </Section>

      <Section id="changes" heading="10. Changes">
        <p>
          We may change these terms. The date at the top moves when we do, and material changes are
          notified by email. Continuing to use the service after a change means you accept it.
        </p>
      </Section>

      <Section id="law" heading="11. Governing law">
        <p>
          {LEGAL.jurisdiction
            ? `These terms are governed by the laws of ${LEGAL.jurisdiction}.`
            : "The governing law will be stated here once the operating entity is registered. Until then, nothing in these terms waives any right you have under the law where you live."}
        </p>
      </Section>

      <Section id="contact" heading="12. Contact">
        <p>
          <span className="mn text-fg">{LEGAL.contactEmail}</span>
        </p>
      </Section>
    </LegalPage>
  );
}
