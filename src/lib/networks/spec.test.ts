import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SIGNATURE_SPECS, verifySignature, type SignatureSpec } from "@/lib/networks/spec";

const MD5_SPEC: SignatureSpec = {
  algorithm: "md5",
  fields: ["txn", "user", "amount"],
  signatureParam: "hash",
  confirmed: true,
};

const HMAC_SPEC: SignatureSpec = { ...MD5_SPEC, algorithm: "hmac-sha256" };

const PARAMS = { txn: "t1", user: "u1", amount: "12.50" };
const SECRET = "s3cret";

function md5(): string {
  return createHash("md5").update(`t1u112.50${SECRET}`).digest("hex");
}

function hmac(): string {
  return createHmac("sha256", SECRET).update("t1u112.50").digest("hex");
}

describe("verifySignature", () => {
  it("accepts a correct md5 signature", () => {
    expect(verifySignature("CPX", { ...PARAMS, hash: md5() }, SECRET, MD5_SPEC)).toBe("ok");
  });

  it("accepts a correct hmac signature", () => {
    expect(verifySignature("LOOTABLY", { ...PARAMS, hash: hmac() }, SECRET, HMAC_SPEC)).toBe("ok");
  });

  it("is case-insensitive about hex, as networks differ on it", () => {
    const upper = md5().toUpperCase();
    expect(verifySignature("CPX", { ...PARAMS, hash: upper }, SECRET, MD5_SPEC)).toBe("ok");
  });

  it("rejects a wrong signature", () => {
    expect(verifySignature("CPX", { ...PARAMS, hash: "0".repeat(32) }, SECRET, MD5_SPEC)).toBe(
      "bad-signature",
    );
  });

  it("rejects a signature computed over different values", () => {
    expect(
      verifySignature("CPX", { ...PARAMS, amount: "9999.00", hash: md5() }, SECRET, MD5_SPEC),
    ).toBe("bad-signature");
  });

  it("rejects a missing signature", () => {
    expect(verifySignature("CPX", PARAMS, SECRET, MD5_SPEC)).toBe("missing-signature");
  });

  it("rejects a correct signature when the spec is unconfirmed", () => {
    // The whole point of the gate: a formula nobody checked against the
    // network's documentation must not be trusted, even when it verifies.
    const unconfirmed = { ...MD5_SPEC, confirmed: false };
    expect(verifySignature("CPX", { ...PARAMS, hash: md5() }, SECRET, unconfirmed)).toBe(
      "unconfirmed-spec",
    );
  });
});

describe("the shipped specs", () => {
  it("are all unconfirmed, so no network is accepted by accident", () => {
    // If this fails, someone set `confirmed` — which is correct only if they
    // read that network's publisher documentation and tested with its sandbox.
    for (const [network, spec] of Object.entries(SIGNATURE_SPECS)) {
      expect(spec.confirmed, network).toBe(false);
    }
  });
});
