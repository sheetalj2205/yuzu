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

/** A pitch-dropping tone: the body of an impact. */
function thump(c: AudioContext, at: number, from: number, to: number,
               dur: number, gain: number, wave: OscillatorType = "sine") {
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = wave;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(gain, at + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  osc.connect(g).connect(c.destination);
  osc.start(at);
  osc.stop(at + dur + 0.02);
}

/**
 * One "dhish": a wind-up, a landing, and a tail.
 *
 * The first version was over in a tenth of a second and read as a click. A
 * screen punch has three parts you actually hear: the arm travelling, the
 * moment it lands, and the room ringing afterwards. The tail is most of what
 * makes it feel like a hit rather than a tap.
 */
function dhish(c: AudioContext, at: number, pitch = 1, heft = 1) {
  // the arm: a rising whoosh, long enough to anticipate the hit
  noise(c, at, 0.26, 0.20 * heft, "bandpass", 420 * pitch, 1.1, 2400 * pitch);

  const land = at + 0.24;
  // the crack of contact
  noise(c, land, 0.13, 0.5 * heft, "highpass", 1500 * pitch, 0.7);
  // the weight behind it
  thump(c, land, 190 * pitch, 38, 0.45, 0.7 * heft);
  // a second lower body so it lands in the chest, not the ear
  thump(c, land + 0.01, 95 * pitch, 30, 0.6, 0.45 * heft, "triangle");
  // the room ringing after
  noise(c, land + 0.05, 0.5, 0.1 * heft, "lowpass", 900 * pitch, 0.8, 200);
  // one slap-back, so it sounds like it happened somewhere
  noise(c, land + 0.14, 0.2, 0.12 * heft, "bandpass", 1100 * pitch, 1.4, 600);
  thump(c, land + 0.14, 120 * pitch, 34, 0.3, 0.2 * heft);
}

/**
 * dhishoom. Two hits, the second heavier, which is the rhythm of the word.
 * Each button varies pitch and weight so a fist is not a mallet.
 */
const HITS: Record<string, { pitch: number; heft: number; gap: number }> = {
  "POW!":   { pitch: 0.85, heft: 1.00, gap: 0.38 },   // fist: blunt, low
  "BONK!":  { pitch: 0.52, heft: 1.20, gap: 0.46 },   // mallet: deepest, slowest
  "SMACK!": { pitch: 1.30, heft: 0.85, gap: 0.30 },   // glove: high and quick
  "ZAP!":   { pitch: 1.75, heft: 0.70, gap: 0.24 },   // lightning: thin, snappy
};

export function playHit(word?: string) {
  const { pitch, heft, gap } = HITS[word ?? "POW!"] ?? HITS["POW!"];
  whenAwake((c) => {
    const at = c.currentTime + 0.01;
    dhish(c, at, pitch, heft * 0.8);                       // dhish...
    dhish(c, at + gap, pitch * 0.88, heft * 1.1);          // ...OOM, heavier
    // and the low end rolls on after both, which is what you feel
    thump(c, at + gap + 0.24, 70 * pitch, 26, 0.9, 0.3 * heft, "sine");
  });
}

/**
 * What an iPhone gets instead of a vibration.
 *
 * iOS Safari has no Vibration API at all, so on those devices a buzz would be
 * silent and invisible unless we make it audible. Here sound is not a
 * soundtrack, it IS the buzz.
 *
 * Deliberately soft. The first version was a sawtooth and a square, which was
 * accurate to a phone motor and horrible to listen to for five days a month.
 * These are sines with a rounded attack and a gentle low-pass, so it reads as a
 * hum you feel rather than a rasp you flinch at. Her cramp is a little higher
 * and firmer than his comfort, but neither is harsh.
 */
export function playBuzz(pattern: number[], kind: "pain" | "comfort") {
  whenAwake((c) => {
    const soften = c.createBiquadFilter();
    soften.type = "lowpass";
    soften.frequency.value = kind === "pain" ? 320 : 220;
    soften.Q.value = 0.7;
    soften.connect(c.destination);

    let at = c.currentTime + 0.01;
    for (let i = 0; i < pattern.length; i += 2) {
      const on = pattern[i] / 1000;
      const off = (pattern[i + 1] ?? 0) / 1000;
      if (on <= 0) { at += off; continue; }

      const peak = kind === "pain" ? 0.26 : 0.18;
      const rise = Math.min(0.045, on * 0.35);      // no clicky edges
      const bus = c.createGain();
      bus.gain.setValueAtTime(0, at);
      bus.gain.linearRampToValueAtTime(peak, at + rise);
      bus.gain.setValueAtTime(peak, Math.max(at + rise + 0.001, at + on - rise));
      bus.gain.linearRampToValueAtTime(0, at + on);
      bus.connect(soften);

      const partials = kind === "pain"
        ? [[88, 1], [132, 0.35], [176, 0.12]] as const      // a fifth above: firm, not sharp
        : [[62, 1], [93, 0.28]] as const;                    // lower, rounder
      for (const [hz, mix] of partials) {
        const osc = c.createOscillator();
        const g = c.createGain();
        osc.type = "sine";
        osc.frequency.value = hz;
        g.gain.value = mix;
        osc.connect(g).connect(bus);
        osc.start(at);
        osc.stop(at + on + 0.03);
      }
      at += on + off;
    }
  });
}

/**
 * "phewww". A long, deflating sigh for a wrong guess.
 *
 * The first attempt was too quiet and too quick to register at all. This one
 * runs for well over a second, is three times louder, and falls the whole way
 * down: breath sweeping from bright to dark, with a pitch sagging underneath
 * it and a last little slump at the end.
 */
export function playPhew() {
  whenAwake((c) => {
    const at = c.currentTime + 0.01;

    // the breath: bright at first, closing to nothing
    noise(c, at, 1.25, 0.5, "bandpass", 2600, 2.0, 260);
    // a touch of body under it so it is not only hiss
    noise(c, at + 0.04, 1.0, 0.22, "lowpass", 900, 0.8, 180);

    // the sag
    const osc = c.createOscillator();
    const g = c.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(560, at);
    osc.frequency.exponentialRampToValueAtTime(190, at + 0.55);
    osc.frequency.exponentialRampToValueAtTime(88, at + 1.25);
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.34, at + 0.07);
    g.gain.setValueAtTime(0.34, at + 0.45);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 1.3);
    osc.connect(g).connect(c.destination);
    osc.start(at);
    osc.stop(at + 1.35);

    // the last slump, like shoulders dropping
    thump(c, at + 1.05, 150, 52, 0.5, 0.2, "sine");
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
