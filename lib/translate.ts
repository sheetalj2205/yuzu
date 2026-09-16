import type { Need, Tag, Translation } from "./types";
import { TAGS } from "./types";

/* ------------------------------------------------------------------ *
 * THE PROMPT. This is the whole AI product — read it before changing. *
 * Each need carries its OWN hints, so he is always nudged toward      *
 * something she still hasn't ticked off.                              *
 * ------------------------------------------------------------------ */
export function buildPrompt(message: string, intensity: number) {
  return `Convert a description of menstrual pain into a phone vibration pattern, and work out everything she needs.

Her words: "${message}"
Her own intensity rating: ${intensity} out of 10.

Her partner will NOT be shown her words. You are the app speaking TO HIM.

IMPORTANT: her message may contain SEVERAL separate needs. Pull out every distinct one (1 to 3).
She is not settled until every one of them is met.

For EACH need, write three short hints addressed to him ("she", "her"), getting gradually
clearer — never quoting or closely paraphrasing her sentence, and never naming a specific object.
The hints for a need must be about THAT need only.

Reply with ONLY this JSON, no other text:
{"envelope":"swell"|"stab"|"grind"|"throb","peak":0-1,"pulse_ms":200-4000,
 "duration_s":10-180,"label":"3-5 word name for this sensation",
 "needs":[{"tag":"heat"|"meds"|"rest"|"company"|"warmth","label":"2-4 words, her side",
           "hints":["vague, max 8 words","warmer, max 10 words","almost tells him, max 10 words"]}]}

Sharp or stabbing -> stab with short pulse_ms. Building or rolling -> swell.
Constant heavy ache -> grind. Pulsing -> throb.
Tags: cold or cramping -> heat. Very sharp pain -> meds. Exhausted, overwhelmed, can't
sleep -> rest. Lonely, low, missing him -> company. Wants to be held or covered -> warmth.

Example — "I am freezing, my back is killing me and I miss you" has THREE needs:
[{"tag":"heat","label":"something warm",
  "hints":["Something is cold.","She wants heat, not a drink.","Heat held against her, low down."]},
 {"tag":"meds","label":"the sharp pain",
  "hints":["Warmth won't reach this one.","Something has to actually dull it.","She needs the pain blocked, not soothed."]},
 {"tag":"company","label":"him, nearby",
  "hints":["She's on her own.","Being alone is part of it.","She wants your voice, not a parcel."]}]`;
}

/* ---------------------------- validation ---------------------------- */
const clamp = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

/** Stock hints per tag — fills in when the model gives a need no hints of its own. */
export const HINT_BANK: Record<Tag, string[]> = {
  heat:    ["Something is cold.", "She wants heat, not a drink.", "Heat held against her, low down."],
  meds:    ["Warmth won't reach this one.", "Something has to actually dull it.", "She needs the pain blocked, not soothed."],
  rest:    ["She's running on empty.", "Something on her list has to go.", "Take tomorrow off her hands."],
  company: ["She's on her own.", "Being alone is part of it.", "She wants your voice, not a parcel."],
  warmth:  ["She wants weight on her.", "Something to curl up under.", "Cover her — not a hot drink."],
};

export function normaliseNeeds(raw: unknown): Need[] {
  const out: Need[] = [];
  if (Array.isArray(raw)) {
    for (const n of raw.slice(0, 3)) {
      if (!n || typeof n !== "object") continue;
      const r = n as Record<string, unknown>;
      let tag = String(r.tag ?? "").toLowerCase() as Tag;
      if (!TAGS.includes(tag)) tag = "heat";
      const hints = Array.isArray(r.hints) && r.hints.length
        ? r.hints.slice(0, 3).map(String)
        : HINT_BANK[tag];
      out.push({ tag, label: String(r.label ?? tag), hints, done: false });
    }
  }
  if (!out.length) out.push({ tag: "heat", label: "something warm", hints: HINT_BANK.heat, done: false });
  return out;
}

export function normalise(raw: Record<string, unknown>, intensity: number): Translation {
  const env = String(raw.envelope ?? "swell");
  return {
    envelope: (["swell","stab","grind","throb"].includes(env) ? env : "swell") as Translation["envelope"],
    peak:       clamp(raw.peak, 0.2, 1, intensity / 10),
    pulse_ms:   Math.round(clamp(raw.pulse_ms, 200, 4000, 1400)),
    duration_s: Math.round(clamp(raw.duration_s, 10, 180, 70)),
    label:      String(raw.label ?? "Unnamed sensation"),
    needs:      normaliseNeeds(raw.needs),
  };
}

/* ------------------------------------------------------------------ *
 * FALLBACK. Runs when Gemini is down or keyless. Never let the demo die.   *
 * ------------------------------------------------------------------ */
export function sniffNeeds(t: string): Need[] {
  const found: Need[] = [];
  const add = (tag: Tag, label: string) =>
    found.push({ tag, label, hints: HINT_BANK[tag], done: false });
  if (/cold|freez|chill|cramp|clench/.test(t))              add("heat",    "something warm");
  if (/sharp|stab|knife|killing|agony|electric/.test(t))    add("meds",    "the sharp pain");
  if (/tired|exhaust|sleep|can'?t think|fog|drain/.test(t)) add("rest",    "actual rest");
  if (/alone|lonely|miss|sad|cry|low/.test(t))              add("company", "him, nearby");
  if (/heavy|ache|back|hold|hug|curl/.test(t))              add("warmth",  "weight on her");
  if (!found.length) add("heat", "something warm");
  return found.slice(0, 3);
}

export function fallback(message: string, intensity: number): Translation {
  const t = message.toLowerCase();
  const base =
    /stab|sharp|knife|electric|shoot|spike/.test(t)
      ? { envelope: "stab"  as const, pulse_ms: 420,  duration_s: 35,  label: "Hot wire, short bursts" }
    : /cold|freez|heavy|exhaust|tired|think|fog/.test(t)
      ? { envelope: "grind" as const, pulse_ms: 2200, duration_s: 110, label: "Leaden cold ache" }
      : { envelope: "swell" as const, pulse_ms: 1600, duration_s: 90,  label: "Slow clenching swell" };

  return { ...base, peak: Math.max(0.2, intensity / 10), needs: sniffNeeds(t), offline: true };
}

/* --------------------------- scoring --------------------------- */
export const unmet = (needs: Need[]) => needs.filter(n => !n.done);

export const score = (needs: Need[], intensity: number) =>
  unmet(needs).length === 0 ? 0 : Math.round(intensity * 10 * unmet(needs).length / needs.length);

/**
 * She said it helped. Tick the need this gift was actually for.
 * If it matches nothing still open, she is still the authority — credit the
 * next open need, so a thoughtful gift is never thrown away.
 */
export function tickOff(needs: Need[], tag: string): Need[] {
  const open = needs.filter(n => !n.done);
  const hit  = open.find(n => n.tag === tag) ?? open[0];
  if (hit) hit.done = true;
  return [...needs];
}

/**
 * The hint he sees: always about the FIRST NEED STILL UNMET, getting clearer
 * with each try. Once she ticks "something warm" off, he stops being told
 * she is cold — that was the bug.
 */
export function hintFor(needs: Need[], tries: number): string | null {
  const open = unmet(needs);
  if (!open.length) return null;
  const hints = open[0].hints.length ? open[0].hints : HINT_BANK[open[0].tag];
  return hints[Math.min(tries >= 4 ? 2 : tries >= 2 ? 1 : 0, hints.length - 1)];
}
