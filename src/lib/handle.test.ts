import { describe, expect, it } from "vitest";
import { allocateHandle, handleSeedFromEmail, normaliseHandle } from "@/lib/handle";

describe("normaliseHandle", () => {
  it("lowercases and collapses unsafe characters", () => {
    expect(normaliseHandle("Reid.Ellery")).toBe("reid_ellery");
    expect(normaliseHandle("a++b")).toBe("a_b");
  });

  it("trims leading and trailing separators", () => {
    expect(normaliseHandle("..reid..")).toBe("reid");
  });

  it("caps length", () => {
    expect(normaliseHandle("a".repeat(50))).toHaveLength(20);
  });
});

describe("handleSeedFromEmail", () => {
  it("uses the local part only, never the domain", () => {
    const seed = handleSeedFromEmail("hanna.pw@gmail.com");
    expect(seed).toBe("hanna_pw");
    expect(seed).not.toContain("gmail");
  });

  it("falls back for local parts too short to be a handle", () => {
    expect(handleSeedFromEmail("ab@example.com")).toBe("member");
    expect(handleSeedFromEmail("@example.com")).toBe("member");
  });
});

describe("allocateHandle", () => {
  it("returns the seed when it is free", async () => {
    const handle = await allocateHandle("ada@example.com", async () => false);
    expect(handle).toBe("ada");
  });

  it("suffixes until it finds a free handle", async () => {
    const taken = new Set(["ada", "ada_2", "ada_3"]);
    const handle = await allocateHandle("ada@example.com", async (c) => taken.has(c));
    expect(handle).toBe("ada_4");
  });

  it("keeps suffixed handles inside the length cap", async () => {
    const seed = "a".repeat(20);
    const taken = new Set([seed]);
    const handle = await allocateHandle(`${seed}@example.com`, async (c) => taken.has(c));
    expect(handle.length).toBeLessThanOrEqual(20);
    expect(handle.endsWith("_2")).toBe(true);
  });
});
