# Legal review — what is outstanding

`/terms`, `/privacy` and `/reward-policy` are live and describe what the product
actually does. They were written from the schema and the code, not from a
template, so the factual parts are accurate.

**They have not been reviewed by a lawyer.** This file lists what has to be
decided by a person before they can be relied on — and, separately, what offer
networks will check during publisher review (HANDOFF.md §4.3).

## Blocks publisher approval

Networks read these pages before approving a publisher. A policy naming no
operator is the usual reason to fail that review.

- [ ] **Registered entity name** — `LEGAL.entityName` in `src/lib/legal.ts`
- [ ] **Jurisdiction** — `LEGAL.jurisdiction`
- [ ] **Company number** — `LEGAL.companyNumber`
- [ ] **Registered address** — `LEGAL.address`

Until `entityName` and `jurisdiction` are set, every legal page shows a banner
saying the operator is not yet named, and the Terms say the governing law will
be stated once the entity is registered. That is honest, but it will not pass a
network review.

## Needs a lawyer

- [ ] **Governing law and dispute resolution.** Terms §11 currently states no
      jurisdiction. Depends on where the entity is registered (§14 question 2).
- [ ] **Limitation of liability.** Terms §9 limits liability to the balance
      owed. Whether that is enforceable depends on jurisdiction, and it is
      unenforceable against consumers in several of the markets the country
      checker targets.
- [ ] **GDPR / UK GDPR.** The country checker targets GB, DE, FR and PL. The
      Privacy notice describes practices accurately but does not state a lawful
      basis per purpose, name a representative, or set retention periods in
      days. All three are required.
- [ ] **Age verification.** Terms §2 requires 18+, but nothing verifies it.
      Torox inventory includes gambling offers, which is a licensing question in
      GB and elsewhere — not just a terms question.
- [ ] **Consumer withdrawal rights** for purchase-required offers in the EU/UK.
- [ ] **Money transmission.** Paying members in USDC and ETH may be a regulated
      activity depending on the jurisdiction chosen.

## Needs ALFA, not a lawyer

- [ ] **Cookie consent.** Only strictly necessary cookies are set today (session
      and referral), so no banner is required yet. Adding analytics or Sentry
      session replay changes that.
- [ ] **Data deletion process.** The Privacy notice promises deletion on
      request. There is no admin tooling for it — it is a manual database
      operation until Phase 3.
- [ ] **Retention periods.** Stated qualitatively ("as long as required"). Real
      numbers are a business decision.

## Deliberately not claimed

The pages do not say the service is GDPR compliant, PCI compliant, licensed, or
regulated, because none of that has been established. Do not add such a claim
without the review that supports it.

## Phase 5

If the token ships, the Terms need a section on it and the Privacy notice needs
one on snapshot data. Neither exists, because Phase 5 is legally gated
(HANDOFF.md §0.2) and must not be built speculatively.
