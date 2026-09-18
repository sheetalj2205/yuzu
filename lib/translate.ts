import type { Need, Tag, Translation } from "./types";
import { MAX_TRIES, TAGS } from "./types";

/* ------------------------------------------------------------------ *
 * THE PROMPT. This is the whole AI product, read it before changing. *
 * Each need carries its OWN hints, so he is always nudged toward      *
 * something she still hasn't ticked off.                              *
 * ------------------------------------------------------------------ */
export function buildPrompt(message: string, intensity: number) {
  return `Convert a description of menstrual pain into a phone vibration pattern, and work out everything she needs.

Her words: "${message}"
Her own intensity rating: ${intensity} out of 10.

Her partner will NOT be shown her words. You are the app speaking TO HIM.

IMPORTANT: her message usually contains SEVERAL separate needs, and missing one is the worst
thing you can do here, because she stays in pain until every one is met.

Before you answer, split her sentence on every "and", every comma, and every separate
complaint. Each distinct thing SHE MENTIONS is its own need, even when two of them could be
soothed the same way. "I am freezing, my back is killing me and I miss you" is THREE needs,
not two: being cold, the pain, and being alone.

Never invent one. If she mentions a single thing, that is ONE need: "my stomach hurts" is one,
not three, and padding it out makes him chase things she never asked for. Count what is in her
sentence and return exactly that, between 1 and 3.

For EACH need, write FIVE short hints addressed to him ("she", "her"), one for each of his
five tries, getting clearer every single time. Hint 1 is almost nothing; hint 5 all but names
what she wants without naming the object itself. Never quote or closely paraphrase her
sentence. The hints for a need must be about THAT need only.

Reply with ONLY this JSON, no other text:
{"envelope":"swell"|"stab"|"grind"|"throb","peak":0-1,"pulse_ms":200-4000,
 "duration_s":10-180,"label":"3-5 word name for this sensation",
 "needs":[{"tag":"heat"|"meds"|"rest"|"company"|"warmth","label":"2-4 words, her side",
           "hints":["barely anything, max 7 words","a little clearer","clearer still",
           "nearly says it","all but names it, max 10 words"]}]}

Sharp or stabbing -> stab with short pulse_ms. Building or rolling -> swell.
Constant heavy ache -> grind. Pulsing -> throb.
Tags: cold or cramping -> heat. Very sharp pain -> meds. Exhausted, overwhelmed, can't
sleep -> rest. Lonely, low, missing him -> company. Wants to be held or covered -> warmth.

Example, "I am freezing, my back is killing me and I miss you" has THREE needs, and the
heat one would read:
{"tag":"heat","label":"something warm","hints":[
  "Something is cold.",
  "Cold from the inside out.",
  "A drink will not reach it.",
  "She needs heat held against her.",
  "Steady warmth, pressed low on her back."]}`;
}

/* ---------------------------- validation ---------------------------- */
const clamp = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

/** Stock hints per tag, fills in when the model gives a need no hints of its own. */
export const HINT_BANK: Record<Tag, string[]> = {
  heat:    ["Something is cold.", "Cold from the inside out.", "A drink will not reach it.",
            "She needs heat held against her.", "Steady warmth, pressed low on her back."],
  meds:    ["This one is sharp.", "Comfort will not touch it.", "Warmth is not going to be enough.",
            "Something has to actually dull it.", "She needs the pain blocked, not soothed."],
  rest:    ["She is running on empty.", "It is not only her body.", "She has nothing left to give today.",
            "Something on her list has to go.", "Take tomorrow off her hands."],
  company: ["She is on her own.", "The room is too quiet.", "Being alone is making it worse.",
            "A parcel will not fix this one.", "She wants your voice, right now."],
  warmth:  ["She has curled up small.", "She wants to be covered.", "Something with weight to it.",
            "Not a drink, something over her.", "Wrap her up and leave it there."],
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
        ? r.hints.slice(0, 5).map(String)
        : HINT_BANK[tag];
      out.push({ tag, label: String(r.label ?? tag), hints, done: false });
    }
  }
  if (!out.length) out.push({ tag: "heat", label: "something warm", hints: HINT_BANK.heat, done: false });
  return out;
}

/**
 * Merge in anything the model missed.
 *
 * Models under-split. Asked for every distinct need, one would routinely come
 * back with two for a sentence that plainly held three, and she would be left
 * with a need nobody was ever told about. The rule reader runs over her message
 * as well, and any tag it finds that the model did not is added with the stock
 * hints for that tag. Same cap of three.
 */
function withMissedNeeds(fromModel: Need[], message: string): Need[] {
  const seen = new Set(fromModel.map(n => n.tag));
  const merged = [...fromModel];
  for (const guessed of sniffNeeds(message.toLowerCase())) {
    if (merged.length >= 3) break;
    if (seen.has(guessed.tag)) continue;
    seen.add(guessed.tag);
    merged.push(guessed);
  }
  return merged;
}

export function normalise(raw: Record<string, unknown>, intensity: number,
                          message = ""): Translation {
  const env = String(raw.envelope ?? "swell");
  return {
    envelope: (["swell","stab","grind","throb"].includes(env) ? env : "swell") as Translation["envelope"],
    peak:       clamp(raw.peak, 0.2, 1, intensity / 10),
    pulse_ms:   Math.round(clamp(raw.pulse_ms, 200, 4000, 1400)),
    duration_s: Math.round(clamp(raw.duration_s, 10, 180, 70)),
    label:      String(raw.label ?? "Unnamed sensation"),
    needs:      withMissedNeeds(normaliseNeeds(raw.needs), message),
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
 * If it matches nothing still open, she is still the authority, credit the
 * next open need, so a thoughtful gift is never thrown away.
 */
export function tickOff(needs: Need[], tag: string): Need[] {
  const open = needs.filter(n => !n.done);
  const hit  = open.find(n => n.tag === tag) ?? open[0];
  if (hit) hit.done = true;
  return [...needs];
}

/**
 * The hint he sees: always about the FIRST NEED STILL UNMET, and a clear step
 * further on every single try.
 *
 * Each need carries five hints but he only gets three goes, so they are spread
 * across the whole ladder, vague, middle, nearly telling him, rather than
 * stopping a third of the way up. Past his last try he keeps the clearest one.
 */
export function hintFor(needs: Need[], tries: number): string | null {
  const open = unmet(needs);
  if (!open.length) return null;
  const hints = open[0].hints.length ? open[0].hints : HINT_BANK[open[0].tag];
  const last = hints.length - 1;
  const step = MAX_TRIES > 1 ? Math.round((tries * last) / (MAX_TRIES - 1)) : last;
  return hints[Math.min(Math.max(step, 0), last)];
}
