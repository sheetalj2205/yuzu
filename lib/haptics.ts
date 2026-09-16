"use client";
import type { Pattern } from "./types";

/**
 * Haptics, with an honest iPhone story.
 *
 * Android Chrome has navigator.vibrate and gets the real thing.
 * iOS Safari has never shipped the Vibration API — there is no flag, no
 * permission, no polyfill. So on iPhone we render the buzz instead of feeling
 * it: the screen pulses to the same rhythm and, if the user turns sound on, a
 * low tone plays through the speaker. Not as good. Far better than nothing.
 */

export const canVibrate = () =>
  typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

/* ---------------- the visual fallback ---------------- */

/** Fires on every buzz so the UI can pulse. Detail is the on/off pattern in ms. */
export const BUZZ_EVENT = "yuzu:buzz";

function announce(pattern: number[], kind: "pain" | "comfort") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BUZZ_EVENT, { detail: { pattern, kind } }));
}

/* ---------------- optional sound (iPhone's only real signal) ---------------- */

const SOUND_KEY = "yuzu-sound";
export const soundOn = () => {
  try { return localStorage.getItem(SOUND_KEY) === "1"; } catch { return false; }
};
export const setSound = (on: boolean) => {
  try { localStorage.setItem(SOUND_KEY, on ? "1" : "0"); } catch {}
};

let ctx: AudioContext | null = null;
function tone(pattern: number[], kind: "pain" | "comfort") {
  if (!soundOn() || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();

    let at = ctx.currentTime;
    for (let i = 0; i < pattern.length; i += 2) {
      const on = pattern[i] / 1000, off = (pattern[i + 1] ?? 0) / 1000;
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      // pain = hard and buzzy; comfort = low and round
      osc.type = kind === "pain" ? "square" : "sine";
      osc.frequency.value = kind === "pain" ? 68 : 44;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(kind === "pain" ? 0.5 : 0.28, at + 0.012);
      gain.gain.setValueAtTime(kind === "pain" ? 0.5 : 0.28, at + on - 0.02);
      gain.gain.linearRampToValueAtTime(0, at + on);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at); osc.stop(at + on);
      at += on + off;
    }
  } catch { /* audio blocked — the visual pulse still runs */ }
}

/* ---------------- the buzzes ---------------- */

function fire(pattern: number[], kind: "pain" | "comfort") {
  if (canVibrate()) { try { navigator.vibrate(pattern); } catch {} }
  announce(pattern, kind);   // always — the pulse runs on every device
  tone(pattern, kind);
}

/** HER cramp on HIS phone: short, hard, jabbing. */
export function buzzPain(p: Pattern) {
  const on  = Math.round(p.pulse_ms * (p.envelope === "stab" ? 0.16 : 0.5) * p.peak);
  const off = Math.max(70, p.pulse_ms - on);
  const pattern: number[] = [];
  for (let i = 0; i < 5; i++) pattern.push(Math.max(45, on), off);
  fire(pattern, "pain");
}

/** HIS comfort on HER phone: slow, long, even — like breathing. */
export function buzzComfort() {
  fire([180, 520, 220, 520, 260], "comfort");
}

/** She hits back. Each strike carries its own rhythm. */
export function buzzStrike(pattern: number[]) {
  fire(pattern, "pain");
}

export function stopBuzz() {
  if (canVibrate()) { try { navigator.vibrate(0); } catch {} }
}

/**
 * His phone does not stop because he tried. It stops when SHE says it stops.
 * Capped at 10 minutes so a real user doesn't rage-quit — a deliberate choice,
 * worth saying out loud in the pitch.
 */
export function startBuzzLoop(p: Pattern, stillUnmet: () => boolean) {
  const started = Date.now();
  const id = setInterval(() => {
    if (!stillUnmet() || Date.now() - started > 10 * 60_000) { clearInterval(id); stopBuzz(); return; }
    buzzPain(p);
  }, 5000);
  return () => { clearInterval(id); stopBuzz(); };
}
