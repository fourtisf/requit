import { describe, expect, it } from "vitest";
import { LEGAL, operatorIdentified, operatorName } from "@/lib/legal";
import { BRAND } from "@/lib/brand";

describe("legal operator details", () => {
  it("reports the operator as unidentified while the entity is unknown", () => {
    // The pages show a banner and the Terms withhold a governing law based on
    // this. It flipping to true without the fields being real would publish a
    // legal page that names nobody and admits nothing.
    expect(operatorIdentified()).toBe(LEGAL.entityName !== null && LEGAL.jurisdiction !== null);
  });

  it("never invents a company name", () => {
    // §14 puts the registered entity with ALFA. A plausible placeholder on a
    // legal page is worse than an absence, because nobody notices it.
    const name = operatorName();
    if (LEGAL.entityName === null) {
      expect(name).toBe(`the operator of ${BRAND.name}`);
      expect(name).not.toMatch(/Inc\.|Ltd|LLC|GmbH/);
    } else {
      expect(name).toBe(LEGAL.entityName);
    }
  });

  it("carries an effective date for every policy", () => {
    for (const [policy, date] of Object.entries(LEGAL.effective)) {
      expect(date, policy).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("routes legal contact through the brand constant", () => {
    // So a domain change does not leave a stale address on a legal page.
    expect(LEGAL.contactEmail).toBe(BRAND.supportEmail);
    expect(LEGAL.privacyEmail).toBe(BRAND.supportEmail);
  });
});
