import type { Need, Tag, Translation } from "./types";
import { MAX_TRIES, TAGS } from "./types";
import { ITEMS } from "./items";

/* ==================================================================== *
 * THE PROMPT. This is the whole AI product, read it before changing.    *
 *                                                                      *
 * Split in two on purpose. SYSTEM carries the job, the drawer and the   *
 * rules, and never changes, so it caches and it cannot be argued with   *
 * by anything she types. The user turn carries only her words. Putting  *
 * the rules in the same turn as her message let her sentence colour     *
 * them: a long, emotional message pulled the model toward inventing     *
 * extra needs, because the instructions had become just more text       *
 * sitting next to it.                                                   *
 * ==================================================================== */

/** The drawer, written out for the model, so hints can aim at real shelves. */
const drawerLines = () => ITEMS.filter(i => !i.bad)
  .map(i => `  - ${i.name} (tag: ${i.tag})`).join("\n");

export const SYSTEM_PROMPT = `You are the hint engine inside Yuzu, a game played by a couple who are apart.

She writes how her period pain feels. HE NEVER SEES HER WORDS. He sees only your
hints, and he answers by tapping ONE thing in this drawer:

${drawerLines()}

He gets ${MAX_TRIES} wrong guesses for the whole round. Every hint you write either
spends one of those or saves one. That is the job.

=====================  STEP 1: COUNT WHAT SHE ASKED FOR  =====================

First list her separate complaints, word for word from her message, in the
"complaints" field. Split on "and", on commas, and on each distinct thing wrong.

Then write exactly ONE need per complaint, in the same order. Same number. Never
more, never fewer.

DO NOT INVENT NEEDS. This is the most damaging thing you can do, because he must
satisfy every need you list before her pain stops, and he cannot satisfy one she
never asked for. If she says only "I just want to be held", that is ONE complaint
and ONE need. Adding a second because pain is usually complicated is a failure.
Silence about warmth is not a request for warmth.

Do not miss one either. "I am freezing, my back is killing me and I miss you" is
THREE complaints, so three needs. Cap at 3, keeping the ones she said loudest.

Pick the tag by what would ACTUALLY FIX IT, since the tag is how his answer is
marked right:
  heat    - cold, or cramp in one place: wants a hot thing pressed on that spot
  warmth  - cold or aching all over: wants covering, weight laid over her
  meds    - sharp, stabbing, pounding pain that has to be blocked
  rest    - worn out, cannot sleep, dreading tomorrow, too much on tomorrow
  company - lonely, low, missing him, wants him there

A complaint about a PART OF HER BODY is never company. "Everything aches", "my
back", "my head" are things happening in her body, so they take heat, warmth or
meds. Use company only for her mood, or for missing him. Getting this wrong sends
him to the wrong shelf with your clearest hint.

========================  STEP 2: THE FIVE HINTS  ========================

Per need, exactly ${MAX_TRIES} hints, spoken to him about her ("she", "her"). One per
guess he has. He is shown ONE at a time and never sees the others, so each must
stand alone as a whole sentence.

Each has its own job. Never reword the one above it. Each must hand him a fact
the one before it did not:

  1. WHERE IT IS. Which part of her, and what it feels like there. Nothing yet
     about what would help. "Her lower back has seized up and it burns."
  2. CROSS ONE OFF. Name a thing that IS in the drawer above, in your own words,
     and say it will not work for this need, so he stops considering it. It must
     be a drawer thing: ruling out an ice pack or a doctor saves him nothing.
     Cross off a shelf that is WRONG for her. Never one that would fix this need,
     and never one that would fix ANOTHER of her needs in this same message.
     Telling him a hot water bottle is useless while she is also freezing costs
     him a guess instead of saving one, and "her playlist will not keep her
     company" talks him out of an answer that was about to be marked right.
  3. ALL BUT THE NAME. The thing itself: what it is, where on her it goes, what he
     does with it. Somebody reading only this line should pick right first go.

By hint ${MAX_TRIES} he must be able to get it. Holding detail back to seem clever
just means she stays in pain.

Rules for every hint:
  - 10 words maximum.
  - Everyday English, the way a worried boyfriend texts. Say tummy, back, hot,
    cold, tired, worn out. Never "core temperature", "thermal", "lumbar",
    "applied directly", "hydration", "administer".
  - Never quote or paraphrase her sentence. He must not be able to reconstruct it.
  - Invent no detail that is not hers. Not the colour of anything, not which
    room, not the time of day.
  - Every hint of a need is about THAT need only.
  - If two of her needs feel close, pull their hints in clearly different
    directions, so he can tell which one he is being asked for.

============================  THE VIBRATION  ============================

envelope: sharp or stabbing = stab (short pulse_ms). Building or rolling = swell.
Constant heavy ache = grind. Pulsing = throb.
peak 0-1, pulse_ms 200-4000, duration_s 10-180, label 3-5 words for the sensation.

==============================  EXAMPLES  ==============================

"I just want to be held"  ->  ONE complaint, ONE need:
complaints: ["I just want to be held"]
needs: [{"tag":"company","label":"to be held","hints":[
  "She is on her own and the quiet aches.",
  "Her playlist would only fill the silence.",
  "Get your arms around her and stay there."]}]

"I am freezing and my back is killing me"  ->  TWO complaints. Notice that
neither rung 3 crosses off the thing the OTHER need wants:
complaints: ["I am freezing", "my back is killing me"]
needs: [
 {"tag":"warmth","label":"the cold","hints":[
  "She has curled up small and cannot get warm.",
  "A cup of tea warms her for a minute.",
  "Lay something soft and heavy over all of her."]},
 {"tag":"meds","label":"her back","hints":[
  "Low in her back, spiking then dropping away.",
  "A long hug cannot reach in that far.",
  "The little box in the bathroom, with water."]}]

NEVER do this, three ways of saying one thing:
["She is in pain.","It really hurts.","She needs the pain to stop."]`;

/** Her turn. Only her words, kept apart from the rules. */
export function userTurn(message: string, intensity: number) {
  return `Her message: "${message}"\nHer own intensity rating: ${intensity} out of 10.`;
}

/* ---------------------------- validation ---------------------------- */
const clamp = (n: unknown, lo: number, hi: number, fb: number) => {
  const v = Number(n);
  return Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : fb;
};

/**
 * Stock hints per tag, used when the model gives a need no hints of its own and
 * by the offline rules. One per guess he has, same three jobs the prompt asks
 * for: where it is, one shelf crossed off, then the thing in all but its name.
 * "heat" and "warmth" are deliberately pulled apart, one is a hot thing pressed
 * on one spot, the other is something soft laid over all of her.
 */
export const HINT_BANK: Record<Tag, string[]> = {
  heat: [
    "Her lower tummy is cold and gripping tight.",
    "A long hug will not reach in that far.",
    "Something hot, held right on her belly.",
  ],
  meds: [
    "One part of her is sharp, spiking then fading.",
    "Warmth will take the edge off nothing here.",
    "The little box in the bathroom, with water.",
  ],
  rest: [
    "She is completely drained and dreading tomorrow.",
    "Nothing you can wrap or heat fixes this.",
    "Clear her morning for her, before she wakes.",
  ],
  company: [
    "She is on her own and the quiet aches.",
    "No hot or soft thing reaches this one.",
    "Your arms, your voice, or something with a heartbeat.",
  ],
  warmth: [
    "She has curled up small and cannot get warm.",
    "Heat on one spot misses most of her.",
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
 * Take the model's rungs, but only the ones that actually climb.
 *
 * The ladder is the product: the last hint has to tell him something the one
 * before it did not. A model that repeats itself hands him three goes at the
 * same vague sentence, so any rung that only rewords the one above it is
 * dropped, and the stock ladder for that tag tops the need back up.
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
      if (kept.length === MAX_TRIES) break;
    }
  }
  for (const h of bank) {
    if (kept.length >= MAX_TRIES) break;
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
 * Words that give away which drawer item a hint is talking about, so a rung
 * that crosses one off can be checked against what she actually needs.
 */
const RULE_OUT: Record<Tag, string> = {
  heat:    "Something hot on one spot is not it.",
  warmth:  "Covering her up will not fix this.",
  meds:    "A painkiller will not touch this one.",
  rest:    "Clearing her diary does nothing right now.",
  company: "Just being there will not be enough.",
};

const SOUNDS_LIKE: Record<Tag, RegExp> = {
  heat:    /\bhot water\b|\brubber pouch\b|\bbottle\b|\btea\b|\bhot drink\b|\bkettle\b/i,
  warmth:  /\bblanket\b|\bduvet\b|\bquilt\b|\bfleece\b|\bcover(ing|ed)?\b|\bwrap\b/i,
  meds:    /\bpainkiller|\bpill|\btablet|\bmedicine\b|\bibuprofen\b/i,
  rest:    /\bcancel|\bmorning off\b|\bher day\b|\bschedule\b|\bdiary\b/i,
  company: /\bhug\b|\bkiss\b|\bplaylist\b|\bmusic\b|\bcat\b|\bcall\b|\byour voice\b/i,
};

/**
 * Throw away a rung that crosses off something she actually needs.
 *
 * Rung 3 is meant to save him a guess by ruling one shelf out. Told that a hot
 * water bottle is useless while she is ALSO freezing, it costs him a guess
 * instead, and it is the one hint he is most likely to believe. The prompt says
 * not to; this is what happens when it does it anyway.
 */
function withoutMisleadingRungs(needs: Need[]): Need[] {
  const wanted = new Set(needs.map(n => n.tag));

  /**
   * The middle rung is the one that crosses a shelf off, and it is held to a
   * stricter rule than the others: it must not name ANY shelf she needs, not
   * even this need's own. "Your playlist will not keep her company" talks him
   * out of an answer that was about to be marked right.
   * The last rung is the opposite job, so naming its own shelf is the point.
   */
  const CROSS_OFF = 1;

  const misleads = (hint: string, own: Tag, at: number) => {
    for (const tag of wanted) {
      if (tag === own && at !== CROSS_OFF) continue;
      if (SOUNDS_LIKE[tag].test(hint)) return true;
    }
    return false;
  };

  /**
   * A replacement cross-off, worked out against what she actually needs.
   *
   * The stock ladder cannot be safe on its own: "a long hug will not reach in
   * that far" is a good line for a cramp and a terrible one the moment she is
   * lonely too. So the shelf to rule out is chosen here, from the ones she has
   * not asked for, where crossing it off can only ever save him a guess.
   */
  const spare = TAGS.find(t => !wanted.has(t));

  return needs.map(need => {
    const bank = HINT_BANK[need.tag];
    // Swapped for a safe rung at the same height, never dropped. Dropping it
    // shortened the ladder, and a short ladder spread over his three guesses
    // showed him the same sentence twice.
    const hints = need.hints.map((h, i) => {
      if (!misleads(h, need.tag, i)) return h;
      if (i === CROSS_OFF && spare) return RULE_OUT[spare];
      return bank[i] ?? bank[bank.length - 1];
    });
    return { ...need, hints };
  });
}

export function normalise(raw: Record<string, unknown>, intensity: number): Translation {
  const env = String(raw.envelope ?? "swell");
  return {
    envelope: (["swell","stab","grind","throb"].includes(env) ? env : "swell") as Translation["envelope"],
    peak:       clamp(raw.peak, 0.2, 1, intensity / 10),
    pulse_ms:   Math.round(clamp(raw.pulse_ms, 200, 4000, 1400)),
    duration_s: Math.round(clamp(raw.duration_s, 10, 180, 70)),
    label:      String(raw.label ?? "Unnamed sensation"),
    needs:      withoutMisleadingRungs(normaliseNeeds(raw.needs)),
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

  // through the same guard as the model's answer: the stock cross-off lines are
  // only safe once they have been checked against what she actually needs
  return { ...base, peak: Math.max(0.2, intensity / 10),
           needs: withoutMisleadingRungs(sniffNeeds(t)), offline: true };
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
 * One rung per guess he has. If a need comes back with fewer than that, the
 * rungs are spread across what there is rather than stopping partway up, so his
 * last hint is always the clearest one written. Past his last try it stays there.
 */
export function hintFor(needs: Need[], tries: number): string | null {
  const open = unmet(needs);
  if (!open.length) return null;
  const hints = open[0].hints.length ? open[0].hints : HINT_BANK[open[0].tag];
  const last = hints.length - 1;
  const step = MAX_TRIES > 1 ? Math.round((tries * last) / (MAX_TRIES - 1)) : last;
  return hints[Math.min(Math.max(step, 0), last)];
}
