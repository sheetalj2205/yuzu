import type { Need, Tag, Translation } from "./types";
import { MAX_TRIES, TAGS } from "./types";
import { ITEMS } from "./items";

/* ------------------------------------------------------------------ *
 * THE PROMPT. This is the whole AI product, read it before changing. *
 * Each need carries its OWN hints, so he is always nudged toward      *
 * something she still hasn't ticked off.                              *
 * ------------------------------------------------------------------ */
export function buildPrompt(message: string, intensity: number) {
  const drawer = ITEMS.filter(i => !i.bad)
    .map(i => `- ${i.name} (helps with: ${i.tag})`).join("\n");

  return `Convert a description of menstrual pain into a phone vibration pattern, and work out everything she needs.

Her words: "${message}"
Her own intensity rating: ${intensity} out of 10.

Her partner will NOT be shown her words. You are the app speaking TO HIM.

He answers by picking ONE thing out of this drawer:
${drawer}
Your hints exist to walk him to the right shelf of that drawer. A hint that could
equally point at every shelf is a wasted hint.

IMPORTANT: her message usually contains SEVERAL separate needs, and missing one is the worst
thing you can do here, because she stays in pain until every one is met.

Before you answer, split her sentence on every "and", every comma, and every separate
complaint. Each distinct thing SHE MENTIONS is its own need, even when two of them could be
soothed the same way. "I am freezing, my back is killing me and I miss you" is THREE needs,
not two: being cold, the pain, and being alone.

Never invent one. If she mentions a single thing, that is ONE need: "my stomach hurts" is one,
not three, and padding it out makes him chase things she never asked for. Count what is in her
sentence and return exactly that, between 1 and 3.

THE HINTS. This is the part people judge. For EACH need write FIVE, addressed to him
("she", "her"), and each one has a DIFFERENT job. Never restate the rung above it in new
words: every rung must hand him a fact the rung before it did not.

  1. WHERE or WHAT. A full sentence naming the part of her that is wrong, or the state
     she is in. Nothing about the cure yet. "Her lower back has seized up." not "Her back."
  2. HOW IT FEELS. Sharp, heavy, cold, hollow, worn out. Still nothing about the cure.
  3. RULE SOMETHING OUT. Take one thing that IS in the drawer above, describe it in your
     own words, and say it will not work for this need, so he stops wasting a guess on it.
     It must be a drawer thing. Ruling out an ice pack or a doctor helps him with nothing.
  4. THE KIND OF HELP. What would actually shift it: heat, blocking the pain, covering her,
     being with her, taking something off her plate.
  5. ALL BUT THE NAME. Describe the thing itself, its shape, where on her it goes, what he
     does with it, so a reader of only this line could pick the right shelf first go.
     Do not print the drawer's own wording for it.

Rules for all five: max 10 words each, and every one a whole sentence that makes sense on
its own, because he is shown them one at a time and never sees the others. Write the way a
worried boyfriend texts: no clinical or technical wording, nothing like "lumbar region",
"thermal", "core temperature" or "applied directly". Say back, tummy, hot, cold, tired.
No quoting or paraphrasing her sentence. The five hints of a need are about THAT need only.
If two of her needs feel similar, make their hints pull in clearly different directions.

Reply with ONLY this JSON, no other text:
{"envelope":"swell"|"stab"|"grind"|"throb","peak":0-1,"pulse_ms":200-4000,
 "duration_s":10-180,"label":"3-5 word name for this sensation",
 "needs":[{"tag":"heat"|"meds"|"rest"|"company"|"warmth","label":"2-4 words, her side",
           "hints":["rung 1","rung 2","rung 3","rung 4","rung 5"]}]}

Sharp or stabbing -> stab with short pulse_ms. Building or rolling -> swell.
Constant heavy ache -> grind. Pulsing -> throb.
Tags: cold or cramping -> heat. Very sharp pain -> meds. Exhausted, overwhelmed, can't
sleep -> rest. Lonely, low, missing him -> company. Wants to be held or covered -> warmth.

GOOD, five rungs that each move him along:
{"tag":"meds","label":"the stabbing","hints":[
  "It is her lower back, on the left.",
  "It spikes, drops away, then spikes again.",
  "Holding something hot there will not touch it.",
  "This one has to be blocked, not soothed.",
  "The little box in the bathroom, with water."]}

BAD, five ways of saying one thing. Never do this:
["She is in pain.","It really hurts.","The pain is bad.","She is hurting a lot.",
 "She needs the pain to stop."]`;
}

/* ---------------------------- validation ---------------------------- */
const clamp = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

/**
 * Stock hints per tag, used when the model gives a need no hints of its own and
 * by the offline rules. Same five rungs the prompt asks for: where, how it
 * feels, what will NOT work, the kind of help, then all but the item's name.
 * "heat" and "warmth" are deliberately pulled apart, one is a hot thing pressed
 * on one spot, the other is something soft laid over all of her.
 */
export const HINT_BANK: Record<Tag, string[]> = {
  heat: [
    "It is low down, across her stomach.",
    "Cold and tight, like a fist closing.",
    "Company will not loosen something this physical.",
    "Only real heat, right on the spot, helps.",
    "Something hot she can hold against her belly.",
  ],
  meds: [
    "One part of her is sharp, not achy.",
    "It spikes, fades, then spikes again.",
    "Warmth will take the edge off nothing here.",
    "This has to be blocked, not soothed.",
    "The little box in the bathroom, with water.",
  ],
  rest: [
    "Her body is not the only worn-out part.",
    "She is already dreading how tomorrow looks.",
    "Nothing you can wrap or heat fixes this.",
    "Something in her day has to disappear.",
    "Clear her morning for her, before she wakes.",
  ],
  company: [
    "The room around her is very quiet.",
    "She is getting through this on her own.",
    "No hot or soft object reaches this one.",
    "She wants a person, not a parcel.",
    "Your arms, your voice, or something with a heartbeat.",
  ],
  warmth: [
    "She has curled up as small as possible.",
    "Not one sore spot, all of her is cold.",
    "Heat on a single place misses most of her.",
    "She wants covering, and wants it to stay.",
    "Pull something soft and heavy over her.",
  ],
};

/** Loose word overlap, to catch two hints that say the same thing twice. */
function tooAlike(a: string, b: string): boolean {
  const words = (t: string) =>
    new Set(t.toLowerCase().replace(/[^a-z\s]/g, "").split(/\s+/).filter(w => w.length > 3));
  const A = words(a), B = words(b);
  if (!A.size || !B.size) return false;
  let same = 0;
  for (const w of A) if (B.has(w)) same++;
  return same / Math.min(A.size, B.size) >= 0.6;
}

/**
 * Take the model's five rungs, but only the ones that actually climb.
 *
 * The ladder is the product: rung 3 has to tell him something rung 2 did not.
 * A model that repeats itself hands him three goes at the same vague sentence,
 * so any rung that only rewords the one above it is dropped, and the stock
 * ladder for that tag tops the need back up to five.
 */
function ladder(raw: unknown, tag: Tag): string[] {
  const bank = HINT_BANK[tag];
  const kept: string[] = [];
  if (Array.isArray(raw)) {
    for (const h of raw) {
      const line = String(h ?? "").trim();
      if (!line) continue;
      if (kept.some(k => tooAlike(k, line))) continue;
      kept.push(line);
      if (kept.length === 5) break;
    }
  }
  for (const h of bank) {
    if (kept.length >= 5) break;
    if (!kept.some(k => tooAlike(k, h))) kept.push(h);
  }
  return kept.length ? kept : bank;
}

export function normaliseNeeds(raw: unknown): Need[] {
  const out: Need[] = [];
  if (Array.isArray(raw)) {
    for (const n of raw.slice(0, 3)) {
      if (!n || typeof n !== "object") continue;
      const r = n as Record<string, unknown>;
      let tag = String(r.tag ?? "").toLowerCase() as Tag;
      if (!TAGS.includes(tag)) tag = "heat";
      out.push({ tag, label: String(r.label ?? tag), hints: ladder(r.hints, tag), done: false });
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
