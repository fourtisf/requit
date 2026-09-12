"use client";

/**
 * The small noises a board makes, and the switch that stops them.
 *
 * Synthesised rather than played from files: three blips are a few lines of
 * oscillator here, and as assets they would be three requests, a licence to
 * check, and another thing the content policy has to allow. Nothing is fetched,
 * so nothing can fail to load.
 *
 * The audio context is built on the first cue rather than on page load, because
 * every browser refuses to start one before a gesture — and because a page that
 * warms up an audio device for a visitor who never pressed play is rude.
 */

export type Cue = "tap" | "score" | "end";

const KEY = "requit.sound";

/** Cues are quiet by design: this is feedback, not a soundtrack. */
const CUES: Record<Cue, { from: number; to: number; seconds: number; peak: number }> = {
  tap: { from: 320, to: 300, seconds: 0.05, peak: 0.05 },
  score: { from: 520, to: 880, seconds: 0.16, peak: 0.09 },
  end: { from: 260, to: 120, seconds: 0.38, peak: 0.08 },
};

let context: AudioContext | null = null;
let wanted = true;

/**
 * The stored preference, read once.
 *
 * Storage can be missing or throw — a private window, blocked site data — and a
 * board that will not render because it could not read a mute setting is a
 * worse bug than a board that makes an unwanted noise.
 */
export function loadSound(): boolean {
  try {
    const stored = window.localStorage.getItem(KEY);
    wanted = stored === null ? true : stored === "on";
  } catch {
    wanted = true;
  }
  return wanted;
}

export function setSound(on: boolean): void {
  wanted = on;
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Preference lost at the end of the session. The switch still works now.
  }
}

export function play(cue: Cue): void {
  if (!wanted || typeof window === "undefined") return;

  try {
    type WithLegacy = typeof window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WithLegacy).webkitAudioContext;
    if (!Ctor) return;

    context ??= new Ctor();
    // Tabs suspend the context when they go to the background; a resumed one is
    // cheaper than a new one, and browsers cap how many can exist.
    if (context.state === "suspended") void context.resume();

    const { from, to, seconds, peak } = CUES[cue];
    const now = context.currentTime;

    const tone = context.createOscillator();
    tone.type = "sine";
    tone.frequency.setValueAtTime(from, now);
    tone.frequency.exponentialRampToValueAtTime(to, now + seconds);

    const level = context.createGain();
    // Ramped, never switched: a gain that jumps to zero is a click in itself.
    level.gain.setValueAtTime(0.0001, now);
    level.gain.exponentialRampToValueAtTime(peak, now + 0.012);
    level.gain.exponentialRampToValueAtTime(0.0001, now + seconds);

    tone.connect(level).connect(context.destination);
    tone.start(now);
    tone.stop(now + seconds + 0.02);
  } catch {
    // No audio device, no permission, a context limit reached. Not a reason to
    // interrupt a game.
  }
}
