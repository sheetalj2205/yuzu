"use client";

/**
 * Yuzu's voice.
 *
 * Two reasons this exists:
 *  1. iPhone has no vibration motor, so a low tone through the speaker is the
 *     only thing a user can actually feel.
 *  2. A buzz is invisible on camera. For the demo video, sound is how the room
 *     hears the difference between her cramp and his hot water bottle.
 *
 * Off by default — nobody wants a period app making noise unasked. The toggle
 * is a user gesture, which is also what browsers require before audio can start.
 */

const KEY = "yuzu-sound";

export const soundOn = () => {
  try { return localStorage.getItem(KEY) === "1"; } catch { return false; }
};
export const setSound = (on: boolean) => {
  try { localStorage.setItem(KEY, on ? "1" : "0"); } catch {}
  if (on) void ensureCtx()?.resume();
};

let ctx: AudioContext | null = null;
function ensureCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    const AC = window.AudioContext
      ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx ??= new AC();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch { return null; }
}

/**
 * A voice is a stack of partials. The trick to something being *annoying* is
 * dissonance and beating — two oscillators a few Hz apart fight each other and
 * produce a wobble the ear cannot tune out. That is what a cheap alarm clock does.
 *
 * pain/strike are built to be irritating on purpose. comfort deliberately is not,
 * because the whole product is the contrast between the two.
 */
type Partial = { wave: OscillatorType; hz: number; gain: number };

/**
 * A voice is a stack of partials plus an amplitude wobble.
 *
 * pain/strike are "rattle": a low motor tone with a hard rattle riding on top,
 * built to sound like a real phone buzzing against a hard table. Chosen over a
 * cleaner alarm tone because the demo video shows a phone on a table — the
 * sound and the picture should agree.
 *
 * The wobble is the important bit. Two oscillators a few Hz apart, plus a fast
 * amplitude flutter, produce a sound the ear cannot settle into. That is what
 * makes it nag instead of drone.
 *
 * comfort is the deliberate opposite: one warm sine, no rattle, no wobble.
 * The contrast between the two is the product.
 */
const VOICES: Record<"pain" | "comfort" | "strike", { partials: Partial[]; wobbleHz: number }> = {
  pain: {
    partials: [
      { wave: "sawtooth", hz: 58,  gain: 0.30 },   // the motor
      { wave: "square",   hz: 174, gain: 0.20 },   // casing rattle
      { wave: "triangle", hz: 232, gain: 0.12 },   // the buzz against the table
    ],
    wobbleHz: 27,
  },
  // her turn — same instrument, wound tighter and higher
  strike: {
    partials: [
      { wave: "sawtooth", hz: 74,  gain: 0.34 },
      { wave: "square",   hz: 210, gain: 0.22 },
      { wave: "triangle", hz: 300, gain: 0.13 },
    ],
    wobbleHz: 33,
  },
  comfort: {
    partials: [
      { wave: "sine", hz: 44, gain: 0.26 },
      { wave: "sine", hz: 88, gain: 0.07 },
    ],
    wobbleHz: 0,
  },
};

/** Play an on/off millisecond pattern as a tone. Mirrors navigator.vibrate exactly. */
export function playPattern(pattern: number[], kind: "pain" | "comfort" | "strike") {
  if (!soundOn()) return;
  const c = ensureCtx();
  if (!c) return;
  const voice = VOICES[kind];

  let at = c.currentTime + 0.01;
  for (let i = 0; i < pattern.length; i += 2) {
    const on = pattern[i] / 1000;
    const off = (pattern[i + 1] ?? 0) / 1000;
    if (on <= 0) { at += off; continue; }

    const bus = c.createGain();
    bus.gain.setValueAtTime(0, at);
    bus.gain.linearRampToValueAtTime(1, at + 0.008);           // hard attack, no easing in
    bus.gain.setValueAtTime(1, Math.max(at + 0.009, at + on - 0.02));
    bus.gain.linearRampToValueAtTime(0, at + on);
    bus.connect(c.destination);

    // amplitude wobble — the thing that makes it nag rather than drone
    if (voice.wobbleHz) {
      const lfo = c.createOscillator();
      const depth = c.createGain();
      lfo.type = "square";
      lfo.frequency.value = voice.wobbleHz;
      depth.gain.value = 0.3;
      lfo.connect(depth).connect(bus.gain);
      lfo.start(at); lfo.stop(at + on + 0.02);
    }

    for (const p of voice.partials) {
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = p.wave;
      osc.frequency.value = p.hz;
      g.gain.value = p.gain;
      osc.connect(g).connect(bus);
      osc.start(at);
      osc.stop(at + on + 0.02);
    }

    at += on + off;
  }
}

/** Little moments that aren't buzzes. */
export function cue(name: "arrive" | "win" | "wrong") {
  if (!soundOn()) return;
  const c = ensureCtx();
  if (!c) return;

  // [frequency, startOffset, length] — simple, readable melodies
  const NOTES: Record<typeof name, [number, number, number][]> = {
    arrive: [[784, 0, 0.13], [1046, 0.1, 0.22]],                    // two-note lift: something landed
    win:    [[523, 0, 0.16], [659, 0.14, 0.16], [784, 0.28, 0.42]], // C-E-G, it's over
    wrong:  [[220, 0, 0.1], [175, 0.09, 0.2]],                      // two notes down: not that
  };

  for (const [hz, delay, len] of NOTES[name]) {
    const at = c.currentTime + 0.01 + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = "triangle";
    osc.frequency.value = hz;
    gain.gain.setValueAtTime(0, at);
    gain.gain.linearRampToValueAtTime(name === "wrong" ? 0.18 : 0.14, at + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + len);
    osc.connect(gain).connect(c.destination);
    osc.start(at);
    osc.stop(at + len + 0.02);
  }
}
