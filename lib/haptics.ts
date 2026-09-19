"use client";
import type { Pattern } from "./types";
import { playBuzz, playHit, playPhew } from "./sound";

/**
 * Haptics, with an honest iPhone story.
 *
 * Android Chrome has navigator.vibrate and gets the real thing.
 * iOS Safari has never shipped the Vibration API, there is no flag, no
 * permission, no polyfill. So on iPhone we render the buzz instead of feeling
 * it: the screen pulses to the same rhythm it would have buzzed with.
 * Not as good. Far better than nothing.
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

/* ---------------- the buzzes ---------------- */

/**
 * A buzz is a buzz, no soundtrack.
 *
 * The cramp and the comfort are felt, not heard: a rattling tone playing out of
 * a phone in a quiet room reads as a bug, not as pain. The only thing that makes
 * a noise in Yuzu is her hitting back, which is meant to be heard.
 *
 * The screen pulse still runs everywhere, because an iPhone cannot vibrate at all.
 */
function fire(pattern: number[], kind: "pain" | "comfort", heard: number[] = pattern) {
  if (canVibrate()) {
    try { navigator.vibrate(pattern); } catch {}
  } else {
    // iPhone has no vibration motor to reach. Sound is the only thing left,
    // so there it is not a soundtrack, it IS the buzz. It plays `heard`, which
    // can be calmer than what a motor gets: a nagging rhythm you feel in your
    // pocket is one thing, the same rhythm as noise in a quiet room is another.
    playBuzz(heard, kind);
  }
  announce(pattern, kind);
}

/**
 * HER cramp on HIS phone. Meant to be a nuisance.
 *
 * It used to be one long buzz and one long rest, repeated evenly: 0.9s on, 1.3s
 * off, again and again. That is the rhythm of slow breathing, which is exactly
 * why it felt soothing, and an even rhythm is one the brain stops noticing
 * after a few rounds. A cramp does not keep time.
 *
 * So this is built from the things that make a buzz hard to ignore: an uneven
 * rhythm he cannot predict, short gaps with no real rest, stutters, and it gets
 * worse the longer he takes (`round` counts the loop's repeats). Each kind of
 * pain still has its own feel, so a stab and an ache are not the same nuisance.
 *
 * Only on and off can be controlled from a web page, never how strong the motor
 * is, so "worse" means denser: more buzz, shorter rests. Each pattern stays under
 * five seconds, the gap between loop repeats, so it never quite stops.
 */
export function buzzPain(p: Pattern, round = 0) {
  fire(painPattern(p, round), "pain", calmPattern(p));
}

/**
 * The old even rhythm, kept for iPhone's SOUND only. Asked to be made soothing
 * because a rattling tone in a quiet room reads as a bug, and it still would:
 * the nuisance version above is for a motor in his pocket, not for speakers.
 */
function calmPattern(p: Pattern): number[] {
  const on  = Math.round(p.pulse_ms * (p.envelope === "stab" ? 0.16 : 0.5) * p.peak);
  const off = Math.max(70, p.pulse_ms - on);
  const out: number[] = [];
  for (let i = 0; i < 5; i++) out.push(Math.max(45, on), off);
  return out;
}

/** The pattern itself, separate so it can be checked without a phone. */
export function painPattern(p: Pattern, round = 0): number[] {
  /*
   * 0 = mild, 1 = as bad as it gets. Her rating sets where it starts; every
   * repeat of the loop (one every five seconds) nudges it worse, reaching the
   * top after roughly two minutes of him not working it out. It used to max out
   * ten seconds in, which left nothing to build towards.
   */
  const heat = Math.min(1, 0.3 + Math.max(0, p.peak) * 0.4 + round * 0.012);
  const rest = (ms: number) => Math.max(45, Math.round(ms * (1.35 - heat)));
  const out: number[] = [];
  const add = (on: number, off: number) => out.push(Math.max(50, Math.round(on)), off);

  switch (p.envelope) {
    case "stab":
      // uneven clusters of sharp jabs: 3, then 2, then 4, then 1
      for (const n of [3, 2, 4, 1, 3]) {
        for (let k = 0; k < n; k++) add(70, rest(60));
        out[out.length - 1] = rest(260 + n * 40);
      }
      break;
    case "throb":
      // a heartbeat that is too fast and skips
      for (let i = 0; i < 7; i++) {
        add(110, rest(70));
        add(170, i % 3 === 2 ? rest(420) : rest(200));
      }
      break;
    case "swell":
      // each wave closes in faster and longer, then snaps back and starts again
      for (let wave = 0; wave < 2; wave++) {
        for (let i = 0; i < 6; i++) add(80 + i * 55, rest(300 - i * 45));
      }
      break;
    case "grind":
    default:
      // a drill: a long buzz broken by stutters, never twice the same length
      for (const long of [520, 380, 640, 300]) {
        add(long, rest(90));
        for (let k = 0; k < 3; k++) add(55, rest(55));
        out[out.length - 1] = rest(160);
      }
      break;
  }

  /*
   * Fill the whole gap between repeats. The loop fires every five seconds, and a
   * pattern that ends at three seconds hands him two seconds of calm every time,
   * which is most of what made the old one feel soothing. The motif repeats
   * until the five seconds are nearly full, then the next loop takes over.
   */
  const motif = [...out];
  let total = out.reduce((a, b) => a + b, 0);
  // a buzz and its rest at a time, so it can stop part way through a motif
  for (let i = 0; out.length < 120; i = (i + 2) % motif.length) {
    const pair = motif[i] + motif[i + 1];
    if (total + pair > 4800) break;
    out.push(motif[i], motif[i + 1]);
    total += pair;
  }
  return out;
}

/** HIS comfort on HER phone: slow, long, even, like breathing. */
export function buzzComfort() {
  fire([180, 520, 220, 520, 260], "comfort");
}

/** She hits back, the one thing in Yuzu you hear as well as feel. */
export function buzzStrike(pattern: number[], word?: string) {
  if (canVibrate()) { try { navigator.vibrate(pattern); } catch {} }
  announce(pattern, "pain");
  playHit(word);
}

/** He guessed wrong. On a phone that cannot buzz, this is how he finds out. */
export function buzzWrong() {
  const pattern = [200, 80, 200, 80, 200, 80, 400];
  if (canVibrate()) { try { navigator.vibrate(pattern); } catch {} }
  playPhew();                       // every device: the sigh is the point
  announce(pattern, "pain");
}

export function stopBuzz() {
  if (canVibrate()) { try { navigator.vibrate(0); } catch {} }
}

/**
 * His phone does not stop because he tried. It stops when SHE says it stops.
 * Capped at 10 minutes so a real user doesn't rage-quit, a deliberate choice,
 * worth saying out loud in the pitch.
 */
export function startBuzzLoop(p: Pattern, stillUnmet: () => boolean) {
  const started = Date.now();
  let round = 0;
  const id = setInterval(() => {
    if (!stillUnmet() || Date.now() - started > 10 * 60_000) { clearInterval(id); stopBuzz(); return; }
    buzzPain(p, ++round);   // a little worse every time it comes round
  }, 5000);
  return () => { clearInterval(id); stopBuzz(); };
}
