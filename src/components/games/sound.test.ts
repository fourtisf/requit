import { afterEach, describe, expect, it, vi } from "vitest";
import { loadSound, play, setSound } from "@/components/games/sound";

/**
 * The storage half, which is the half that can fail.
 *
 * A private window, blocked site data or a browser that simply refuses will
 * throw from localStorage, and a board that will not render because it could
 * not read a mute setting is a worse bug than one that makes an unwanted noise.
 */
function withStorage(storage: Partial<Storage>) {
  vi.stubGlobal("window", { localStorage: storage } as unknown as Window);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("remembering the switch", () => {
  it("starts on when nothing has been stored", () => {
    withStorage({ getItem: () => null, setItem: () => undefined });
    expect(loadSound()).toBe(true);
  });

  it("reads what was stored", () => {
    withStorage({ getItem: () => "off", setItem: () => undefined });
    expect(loadSound()).toBe(false);

    withStorage({ getItem: () => "on", setItem: () => undefined });
    expect(loadSound()).toBe(true);
  });

  it("writes the choice under one key", () => {
    const written: [string, string][] = [];
    withStorage({
      getItem: () => null,
      setItem: (key: string, value: string) => written.push([key, value]),
    });

    setSound(false);
    setSound(true);
    expect(written).toEqual([
      ["requit.sound", "off"],
      ["requit.sound", "on"],
    ]);
  });

  it("falls back to on when storage refuses to be read", () => {
    withStorage({
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    });
    expect(loadSound()).toBe(true);
  });

  it("keeps the switch working when the choice cannot be saved", () => {
    withStorage({
      getItem: () => null,
      setItem: () => {
        throw new Error("full");
      },
    });
    // The preference is lost at the end of the session; nothing throws at the
    // player, and the setting still applies for as long as the tab is open.
    expect(() => setSound(false)).not.toThrow();
  });
});

describe("playing a cue", () => {
  it("does nothing at all on a machine with no audio", () => {
    withStorage({ getItem: () => null, setItem: () => undefined });
    loadSound();
    // No AudioContext on the stub: a missing audio device is not a reason to
    // interrupt a game.
    expect(() => play("score")).not.toThrow();
  });

  it("stays silent while the switch is off", () => {
    withStorage({ getItem: () => "off", setItem: () => undefined });
    loadSound();

    const context = vi.fn();
    vi.stubGlobal("window", {
      localStorage: { getItem: () => "off", setItem: () => undefined },
      AudioContext: context,
    } as unknown as Window);

    play("tap");
    expect(context).not.toHaveBeenCalled();
  });
});
