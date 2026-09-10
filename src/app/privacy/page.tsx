import { LegalPage, Section, Callout } from "@/components/legal-page";
import { BRAND } from "@/lib/brand";
import { LEGAL, operatorName } from "@/lib/legal";

export const metadata = {
  title: "Privacy",
  description: `What ${BRAND.name} collects, why, and what you can do about it.`,
};

/**
 * Written from the schema rather than from a template — every item listed here
 * is a column that actually exists. Anything requiring a legal decision
 * (lawful basis, retention periods, the supervisory authority) is marked in
 * docs/LEGAL-REVIEW.md rather than guessed at here.
 */
export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      summary="What we collect, why we collect it, who else sees it, and what you can ask us to do with it."
      effective={LEGAL.effective.privacy}
    >
      <Section id="short" heading="The short version">
        <p>
          We collect what is needed to pay you and to keep the service from being drained by fraud.
          We do not sell personal data, and we do not run advertising trackers on this site.
        </p>
        <Callout>
          One thing to understand before you start: <b>payouts are public</b>. They settle on a
          public blockchain, where the amount, the address and the time are permanently visible to
          anyone, and they cannot be deleted — by us or by you.
        </Callout>
      </Section>

      <Section id="collect" heading="What we collect">
        <p>
          <b>When you create an account.</b> Your email address. A handle derived from it, which is
          public. The country your sign-up request came from, taken from the network edge rather
          than asked, because offers are matched by country and a self-declared country is trivially
          gamed.
        </p>
        <p>
          <b>To keep the service usable.</b> A device fingerprint, a one-way hash of your IP
          address, and a risk score for that address. We store the hash, not the address itself, and
          it is salted so a leaked database cannot be reversed back into addresses.
        </p>
        <p>
          <b>When you complete an offer.</b> What the offer network tells us: which offer, which
          milestone, how much, and the raw confirmation they sent. That record is what proves you
          are owed money, so it is kept.
        </p>
        <p>
          <b>When you add a wallet.</b> The blockchain address and the signature proving you control
          it. We never receive or ask for a seed phrase or a private key.
        </p>
        <p>
          <b>When you withdraw.</b> The amount, the destination address, and the transaction hash.
        </p>
        <p>
          <b>When you open a dispute.</b> What you write, and any evidence you attach.
        </p>
      </Section>

      <Section id="why" heading="Why we collect it">
        <ul className="flex list-disc flex-col gap-2 pl-5 marker:text-fg-4">
          <li>Your email is how you sign in — there is no password to store or leak.</li>
          <li>Your country decides which offers you are eligible for.</li>
          <li>
            Device and IP signals detect the multi-account abuse this category attracts. If our
            traffic quality drops, the offer networks cut us off, and there is no product left.
          </li>
          <li>Reward and withdrawal records are the account of what you are owed and were paid.</li>
        </ul>
      </Section>

      <Section id="sharing" heading="Who else sees it">
        <p>
          <b>Offer networks.</b> CPX Research, Lootably, TimeWall and Torox. When you open an offer
          we pass an identifier so your completion can be attributed back to you, plus the targeting
          data the offer needs. Each has its own privacy policy, and what the advertiser behind an
          offer collects is between you and them.
        </p>
        <p>
          <b>The public blockchain.</b> Every payout is a transaction on Solana or Base. Amount,
          address, and time are public forever.
        </p>
        <p>
          <b>Our own proof page.</b> We publish recent payouts with the amount, the chain and the
          transaction hash. Your handle appears alongside them only if you leave that on — you can
          turn it off in settings, and the row then shows as anonymous. The amount and hash stay
          public either way, because a payout nobody can verify is not proof of anything.
        </p>
        <p>
          <b>Service providers.</b> The hosting, email and error-reporting services this site runs
          on. Our error reports strip cookies, authentication headers and query strings before they
          are sent, because sign-in codes and wallet addresses travel in query strings.
        </p>
        <p>We do not sell personal data to anyone.</p>
      </Section>

      <Section id="cookies" heading="Cookies">
        <p>
          A session cookie, so you stay signed in. A referral cookie, if you arrived through
          someone&rsquo;s invite link, so they get credited when you sign up. That is all — there
          are no advertising or analytics cookies on this site.
        </p>
      </Section>

      <Section id="rights" heading="What you can ask for">
        <p>
          <b>A copy.</b> Your full statement — every reward and withdrawal — downloads as a CSV from
          your history page, without asking us.
        </p>
        <p>
          <b>Correction.</b> Email us if something is wrong.
        </p>
        <p>
          <b>Deletion.</b> Email us and we will close the account and remove your personal data.
          Two limits: we keep the minimum record of payments we have made, because that is a
          financial record; and transactions already on a blockchain cannot be deleted by anyone.
        </p>
        <p>
          <b>Email.</b> Every notification carries a one-click unsubscribe. Sign-in codes are not
          notifications — they are how you get into your account, so they are always sent.
        </p>
        <p>
          Write to <span className="mn text-fg">{LEGAL.privacyEmail}</span> from the address on the
          account.
        </p>
      </Section>

      <Section id="keeping" heading="How long we keep it">
        <p>
          Account and payment records are kept while the account is open and for as long afterwards
          as we are required to keep financial records. Device and IP signals are kept while they
          are useful for fraud detection. Disputes are kept with the reward they concern.
        </p>
      </Section>

      <Section id="who" heading="Who is responsible">
        <p>
          {operatorName()} operates {BRAND.name} and is responsible for the data described here.
          Questions and requests go to <span className="mn text-fg">{LEGAL.privacyEmail}</span>.
        </p>
      </Section>
    </LegalPage>
  );
}
