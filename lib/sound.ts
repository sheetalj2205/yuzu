"use client";

/**
 * Yuzu makes exactly one noise: her hitting back.
 *
 * Everything else, her cramp, his hot water bottle, is felt, not heard.
 * A rattling tone out of a phone in a quiet room reads as a malfunction.
 *
 * The punch is built rather than sampled: a Bollywood "dhishoom" is three
 * things stacked, a whoosh of air as the arm travels, a sharp crack as it
 * lands, and a low boom under it that you feel more than hear. Synthesising it
 * means no audio file to load, nothing to go wrong on a slow connection, and
 * nobody's copyright to borrow.
 */

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
 * Why the punch sometimes made no sound.
 *
 * A browser will not let a page make noise until the person has touched it, and
 * it suspends the audio clock again every time the page goes to the background.
 * Her punch lands on HIS phone, and at that moment he may not have touched
 * anything for a while, so the context was asleep and the sound was scheduled
 * into silence. It worked only if he happened to have tapped recently, which is
 * exactly the "sometimes" he was seeing.
 *
 * So: wake it on his very first touch of the page, wake it again whenever he
 * comes back to the tab, and if it is still asleep when a sound is asked for,
 * wait for it to wake before scheduling.
 */
export function unlockAudio() {
  const c = ensureCtx();
  if (!c) return;
  // a moment of silence, which is what actually unlocks iOS
  try {
    const buf = c.createBuffer(1, 1, c.sampleRate);
    const src = c.createBufferSource();
    src.buffer = buf;
    src.connect(c.destination);
    src.start(0);
  } catch { /* the resume above may be enough on its own */ }
}

/** Run `play` once the audio clock is actually running. */
function whenAwake(play: (c: AudioContext) => void) {
  const c = ensureCtx();
  if (!c) return;
  if (c.state === "running") { play(c); return; }
  c.resume().then(() => play(c)).catch(() => { /* nothing more to try */ });
}

/** Filtered white noise, the air, and the crack. */
function noise(c: AudioContext, at: number, dur: number, gain: number,
               type: BiquadFilterType, hz: number, q = 1, sweepTo?: number) {
  const frames = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, frames, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frames; i++) data[i] = Math.random() * 2 - 1;

  const src = c.createBufferSource();
  src.buffer = buf;

  const filter = c.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(hz, at);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, at + dur);
  filter.Q.value = q;

  const g = c.createGain();
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + Math.min(0.012, dur * 0.2));
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);

  src.connect(filter).connect(g).connect(c.destination);
  src.start(at);
  src.stop(at + dur + 0.02);
}

/** A pitch-dropping sine, the body of the impact. */
function boom(c: AudioContext, at: number, from: number, to: number, dur: number, gain: number) {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = "sine";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/** One "dhish", whoosh in, crack, boom. */
function dhish(c: AudioContext, at: number, pitch = 1, heft = 1) {
  noise(c, at, 0.10, 0.22 * heft, "bandpass", 900 * pitch, 1.2, 2600 * pitch);  // the arm
  noise(c, at + 0.085, 0.09, 0.5 * heft, "highpass", 1700 * pitch, 0.7);        // the crack
  boom(c, at + 0.085, 150 * pitch, 42, 0.30, 0.65 * heft);                      // the weight
}

/**
 * dhishoom. Two hits, the second heavier, that is the rhythm of the word.
 * Each button varies pitch and weight so a fist is not a mallet.
 */
const HITS: Record<string, { pitch: number; heft: number; gap: number }> = {
  "POW!":   { pitch: 0.85, heft: 1.00, gap: 0.16 },   // fist: blunt, low
  "BONK!":  { pitch: 0.55, heft: 1.15, gap: 0.20 },   // mallet: deepest, slowest
  "SMACK!": { pitch: 1.35, heft: 0.80, gap: 0.12 },   // glove: high, fast, flat
  "ZAP!":   { pitch: 1.80, heft: 0.65, gap: 0.08 },   // lightning: thin, snappy
};

export function playHit(word?: string) {
  const c = ensureCtx();
  if (!c) return;
  const { pitch, heft, gap } = HITS[word ?? "POW!"] ?? HITS["POW!"];
  const at = c.currentTime + 0.01;
  dhish(c, at, pitch, heft * 0.85);            // dhish…
  dhish(c, at + gap, pitch * 0.92, heft);      // …oom
}

/**
 * What an iPhone gets instead of a vibration.
 *
 * iOS Safari has no Vibration API at all, so on those devices a buzz is silent
 * and invisible unless we make it audible. These are the buzz patterns played
 * as sound, using the same rhythm the motor would have used: hard and buzzy for
 * her cramp, low and round for his comfort.
 */
export function playBuzz(pattern: number[], kind: "pain" | "comfort") {
  whenAwake((c) => {
    let at = c.currentTime + 0.01;
    for (let i = 0; i < pattern.length; i += 2) {
      const on = pattern[i] / 1000;
      const off = (pattern[i + 1] ?? 0) / 1000;
      if (on <= 0) { at += off; continue; }

      const bus = c.createGain();
      bus.gain.setValueAtTime(0, at);
      bus.gain.linearRampToValueAtTime(kind === "pain" ? 0.34 : 0.2, at + 0.01);
      bus.gain.setValueAtTime(kind === "pain" ? 0.34 : 0.2, Math.max(at + 0.011, at + on - 0.02));
      bus.gain.linearRampToValueAtTime(0, at + on);
      bus.connect(c.destination);

      const partials = kind === "pain"
        ? [["sawtooth", 58], ["square", 172]] as const
        : [["sine", 48], ["sine", 96]] as const;
      for (const [wave, hz] of partials) {
        const osc = c.createOscillator();
        osc.type = wave;
        osc.frequency.value = hz;
        osc.connect(bus);
        osc.start(at);
        osc.stop(at + on + 0.02);
      }
      at += on + off;
    }
  });
}

/**
 * "phewww". A long falling sigh for a wrong guess: filtered noise sweeping down,
 * with a pitch falling under it. Deflating on purpose.
 */
export function playPhew() {
  whenAwake((c) => {
    const at = c.currentTime + 0.01;
    noise(c, at, 0.75, 0.2, "bandpass", 2200, 3.5, 320);   // the air going out
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(420, at);
    osc.frequency.exponentialRampToValueAtTime(110, at + 0.7);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.16, at + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.75);
    osc.connect(g).connect(c.destination);
    osc.start(at);
    osc.stop(at + 0.8);
  });
}

/** Little moments that aren't punches. */
export function cue(name: "arrive" | "win" | "wrong" | "heart" | "kiss") {
  const NOTES: Record<typeof name, [number, number, number][]> = {
    arrive: [[784, 0, 0.13], [1046, 0.10, 0.22]],                       // something landed
    win:    [[523, 0, 0.16], [659, 0.14, 0.16], [784, 0.28, 0.42]],     // it's over
    wrong:  [[220, 0, 0.10], [175, 0.09, 0.20]],                        // not that
    heart:  [[880, 0, 0.10], [1174, 0.08, 0.26]],                       // she says it helped
    kiss:   [[1046, 0, 0.09], [1318, 0.07, 0.09], [1568, 0.14, 0.09],
             [2093, 0.21, 0.34]],                                       // all of it, done
  };

  whenAwake((c) => {
    for (const [hz, delay, len] of NOTES[name]) {
      const at = c.currentTime + 0.01 + delay;
      const osc = c.createOscillator();
      const g = c.createGain();
      osc.type = "triangle";
      osc.frequency.value = hz;
      g.gain.setValueAtTime(0, at);
      g.gain.linearRampToValueAtTime(name === "wrong" ? 0.18 : 0.13, at + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, at + len);
      osc.connect(g).connect(c.destination);
      osc.start(at);
      osc.stop(at + len + 0.02);
    }
  });
}
